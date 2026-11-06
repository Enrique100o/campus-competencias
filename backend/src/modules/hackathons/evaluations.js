import {
  Rubric,
  Project,
  Assignment,
  Evaluation,
  HackRegistration,
} from "../workflow/models.js";
import { User } from "../../models.js";
import {
  ensure,
  formFields,
  text,
  number,
  id,
  eventFor,
  windowOpen,
  audit,
  plain,
  reason,
} from "../workflow/common.js";

/** Exige pesos que sumen 100 y conserva la escala desde la primera evaluación. */
export async function saveRubric(req, event) {
  formFields(req.body, [
    "criterios",
    "agregacion",
    "desempates",
    "juradosMinimos",
    "politicaEmpates",
  ]);
  ensure(
    !["publicado", "cancelado"].includes(event.estado),
    "La rúbrica del evento cerrado está protegida.",
    409,
  );
  ensure(
    !(await Evaluation.exists({ hackaton: event._id })),
    "La rúbrica queda bloqueada desde la primera evaluación.",
    409,
  );
  const body = req.body,
    previous = await Rubric.findOne({ hackaton: event._id });
  ensure(
    Array.isArray(body.criterios) &&
      body.criterios.length > 0 &&
      body.criterios.length <= 20,
    "Configura entre 1 y 20 criterios.",
  );
  const criterios = body.criterios.map((c) => {
    formFields(c, ["id", "nombre", "minimo", "maximo", "peso"]);
    const minimo = number(c.minimo, "mínimo"),
      maximo = number(c.maximo, "máximo");
    ensure(maximo > minimo, "El máximo debe ser mayor que el mínimo.");
    return {
      ...(c.id ? { _id: id(c.id) } : {}),
      nombre: text(c.nombre, "criterio", 100, 2),
      minimo,
      maximo,
      peso: number(c.peso, "peso", 0.01, 100),
    };
  });
  ensure(
    new Set(criterios.map((c) => c.nombre.toLowerCase())).size ===
      criterios.length,
    "No repitas criterios.",
  );
  ensure(
    Math.abs(criterios.reduce((n, c) => n + c.peso, 0) - 100) < 1e-6,
    "Los pesos deben sumar 100 %.",
  );
  ensure(
    ["promedio", "suma"].includes(body.agregacion || "promedio"),
    "Agregación inválida.",
  );
  ensure(
    ["pendiente", "compartido"].includes(body.politicaEmpates || "pendiente"),
    "Política de empate inválida.",
  );
  const minimum = number(body.juradosMinimos || 1, "jurados mínimos", 1, 20);
  ensure(Number.isInteger(minimum), "La cantidad de jurados debe ser entera.");
  const record = previous || new Rubric({ hackaton: event._id });
  audit(req, "hackatones", event, previous);
  record.criterios = criterios;
  const tieBreaks = body.desempates || [];
  ensure(
    Array.isArray(tieBreaks) &&
      new Set(tieBreaks).size === tieBreaks.length &&
      tieBreaks.every((k) =>
        record.criterios.some((c) => String(c._id) === k || c.nombre === k),
      ),
    "Los desempates deben identificar criterios de esta rúbrica.",
  );
  record.desempates = tieBreaks.map((k) =>
    String(
      record.criterios.find((c) => String(c._id) === k || c.nombre === k)._id,
    ),
  );
  record.agregacion = body.agregacion || "promedio";
  record.juradosMinimos = minimum;
  record.politicaEmpates = body.politicaEmpates || "pendiente";
  if (previous) record.version++;
  await record.save();
  return record;
}

/** Asigna únicamente jurados activos y evita duplicados y evaluación del propio equipo. */
export async function assignJury(req, previous) {
  formFields(
    req.body,
    previous ? ["activo", "motivo"] : ["proyecto", "jurado"],
  );
  const project = await Project.findById(
    id(previous?.proyecto || req.body.proyecto),
  );
  ensure(project?.estado === "entregado", "El proyecto debe estar entregado.");
  const event = await eventFor(req.user, "hackatones", project.hackaton, true);
  ensure(
    ["entrega", "evaluacion"].includes(event.estado),
    "Esta etapa no admite asignaciones.",
    409,
  );
  if (previous) {
    ensure(
      typeof req.body.activo === "boolean",
      "Indica si la asignación está activa.",
    );
    reason(req.body);
    ensure(
      !(await Evaluation.exists({
        proyecto: project._id,
        jurado: previous.jurado,
        estado: "enviada",
      })),
      "Una asignación con evaluación enviada no se retira; conserva el historial.",
      409,
    );
    audit(req, "hackatones", event, previous, req.body.motivo);
    previous.activo = req.body.activo;
    previous.motivo = req.body.motivo;
    await previous.save();
    return previous;
  }
  const jury = await User.findById(id(req.body.jurado));
  ensure(
    jury?.estado === "activo" && jury.rol === "jurado",
    "Selecciona una cuenta activa con rol jurado.",
  );
  const registration = await HackRegistration.findById(
    project.inscripcion,
  ).populate("plantilla.participante", "usuario");
  ensure(
    !registration.plantilla.some(
      (p) => String(p.participante?.usuario) === String(jury._id),
    ),
    "Un integrante no puede evaluar su propio proyecto.",
  );
  ensure(
    !(await Assignment.exists({ proyecto: project._id, jurado: jury._id })),
    "Este jurado ya está asignado al proyecto.",
    409,
  );
  audit(req, "hackatones", event, null);
  return Assignment.create({
    proyecto: project._id,
    hackaton: event._id,
    jurado: jury._id,
    creadoPor: req.user._id,
  });
}

/** El servidor verifica cada criterio y calcula el total; el cliente no puede enviar su propia nota total. */
export async function saveEvaluation(req, previous) {
  ensure(
    req.user.rol === "jurado",
    "Solo el jurado asignado puede evaluar.",
    403,
  );
  formFields(req.body, [
    "proyecto",
    "criterios",
    "observaciones",
    "estado",
    "motivo",
  ]);
  const project = await Project.findById(
    id(previous?.proyecto || req.body.proyecto),
  );
  ensure(project?.estado === "entregado", "El proyecto debe estar entregado.");
  ensure(
    !previous || String(previous.jurado) === String(req.user._id),
    "No puedes modificar la evaluación de otro jurado.",
    403,
  );
  const event = await eventFor(req.user, "hackatones", project.hackaton);
  windowOpen(event, "evaluacion", "evaluacionInicio", "evaluacionFin");
  ensure(
    await Assignment.exists({
      proyecto: project._id,
      jurado: req.user._id,
      activo: true,
    }),
    "No tienes asignado este proyecto.",
    403,
  );
  const rubric = await Rubric.findOne({ hackaton: event._id });
  ensure(rubric, "El evento no tiene rúbrica.");
  const existent = await Evaluation.findOne({
    proyecto: project._id,
    jurado: req.user._id,
  });
  ensure(
    previous || !existent,
    "Ya existe tu evaluación; abre su edición.",
    409,
  );
  if (previous?.estado === "enviada") reason(req.body);
  const state = req.body.estado || "borrador";
  ensure(
    ["borrador", "enviada"].includes(state),
    "Estado de evaluación inválido.",
  );
  ensure(
    !previous || previous.estado !== "enviada" || state === "enviada",
    "Una evaluación enviada no vuelve a borrador; corrígela con motivo.",
  );
  ensure(
    Array.isArray(req.body.criterios),
    "Agrega los puntajes por criterio.",
  );
  const seen = new Set();
  let total = 0;
  const criterios = req.body.criterios.map((score) => {
    formFields(score, ["criterio", "valor", "id"]);
    const key = id(score.criterio),
      criterion = rubric.criterios.id(key);
    ensure(criterion && !seen.has(key), "Criterio desconocido o repetido.");
    seen.add(key);
    const value = number(
      score.valor,
      criterion.nombre,
      criterion.minimo,
      criterion.maximo,
    );
    total +=
      ((value - criterion.minimo) / (criterion.maximo - criterion.minimo)) *
      criterion.peso;
    return { criterio: key, valor: value };
  });
  ensure(
    state !== "enviada" || criterios.length === rubric.criterios.length,
    "Completa todos los criterios antes de enviar.",
  );
  const data = {
    proyecto: project._id,
    hackaton: event._id,
    jurado: req.user._id,
    criterios,
    observaciones: req.body.observaciones
      ? text(req.body.observaciones, "observaciones", 3000)
      : "",
    estado: state,
    total: Math.round(total * 1e6) / 1e6,
    rubricaVersion: rubric.version,
    rubrica: plain(rubric),
    proyectoVersion: project.version,
    motivo: req.body.motivo || "",
    ...(state === "enviada" ? { enviadaEn: new Date() } : {}),
  };
  audit(req, "hackatones", event, previous, req.body.motivo || "");
  if (previous) {
    Object.assign(previous, data);
    previous.version++;
    await previous.save();
    return previous;
  }
  return Evaluation.create(data);
}

/** Relaciona las colecciones con agregaciones MongoDB y separa una nota cero de evaluaciones aún pendientes. */
export async function hackathonReport(event) {
  const rubric = await Rubric.findOne({ hackaton: event._id });
  ensure(rubric, "Configura primero la rúbrica.", 409);
  // MongoDB reúne proyectos, equipo, inscripción, asignaciones y notas. Los borradores no se agregan.
  const projects = await Project.aggregate([
    { $match: { hackaton: event._id, estado: "entregado" } },
    {
      $lookup: {
        from: "equipos",
        localField: "equipo",
        foreignField: "_id",
        as: "equipoData",
      },
    },
    {
      $lookup: {
        from: "inscripciones_hackaton",
        localField: "inscripcion",
        foreignField: "_id",
        as: "inscripcionData",
      },
    },
    { $match: { "inscripcionData.estado": "confirmada" } },
    {
      $lookup: {
        from: "asignaciones_jurados",
        let: { project: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$proyecto", "$$project"] },
                  { $eq: ["$activo", true] },
                ],
              },
            },
          },
        ],
        as: "asignaciones",
      },
    },
    {
      $lookup: {
        from: "evaluaciones",
        let: { project: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$proyecto", "$$project"] },
                  { $eq: ["$estado", "enviada"] },
                ],
              },
            },
          },
        ],
        as: "evaluaciones",
      },
    },
    {
      $project: {
        nombre: 1,
        equipo: { $arrayElemAt: ["$equipoData.nombre", 0] },
        asignaciones: 1,
        evaluaciones: 1,
      },
    },
    { $sort: { nombre: 1 } },
  ]);
  const rows = projects.map((p) => {
    const evaluations = p.evaluaciones.filter((e) =>
      p.asignaciones.some((a) => String(a.jurado) === String(e.jurado)),
    );
    const expected = Math.max(rubric.juradosMinimos, p.asignaciones.length);
    const complete =
      evaluations.length === expected &&
      evaluations.every((e) => e.rubricaVersion === rubric.version);
    const sum = evaluations.reduce((n, e) => n + e.total, 0);
    const score = evaluations.length
      ? rubric.agregacion === "suma"
        ? sum
        : sum / evaluations.length
      : null;
    const tie = rubric.desempates.map((key) => {
      const scores = evaluations
        .map((e) => e.criterios.find((c) => c.criterio === key)?.valor)
        .filter((v) => v !== undefined);
      return scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
    });
    return {
      id: String(p._id),
      nombre: p.nombre,
      equipo: p.equipo,
      esperadas: expected,
      recibidas: evaluations.length,
      pendientes: Math.max(0, expected - evaluations.length),
      completo: complete,
      puntaje: score,
      desempates: tie,
    };
  });
  const compare = (a, b) => {
    if (a.completo !== b.completo) return a.completo ? -1 : 1;
    const diff = (b.puntaje ?? -1) - (a.puntaje ?? -1);
    if (Math.abs(diff) > 1e-8) return diff;
    for (let i = 0; i < rubric.desempates.length; i++) {
      const d = (b.desempates[i] ?? -1) - (a.desempates[i] ?? -1);
      if (Math.abs(d) > 1e-8) return d;
    }
    return 0;
  };
  rows.sort(compare);
  rows.forEach((r, i) => {
    r.posicion = r.completo
      ? i && compare(r, rows[i - 1]) === 0
        ? rows[i - 1].posicion
        : i + 1
      : null;
    r.empate =
      r.completo &&
      Boolean(
        (i && compare(r, rows[i - 1]) === 0) ||
        (i + 1 < rows.length && compare(r, rows[i + 1]) === 0),
      );
  });
  const complete = rows.length > 0 && rows.every((r) => r.completo);
  const winnerTie = rows[0]?.empate;
  return {
    hackaton: String(event._id),
    rubricaVersion: rubric.version,
    agregacion: rubric.agregacion,
    formula:
      "Por jurado: suma de ((valor - mínimo) / (máximo - mínimo)) × peso; total sobre 100.",
    proyectos: rows,
    completo: complete,
    publicable:
      complete && (!winnerTie || rubric.politicaEmpates === "compartido"),
    ganadores: complete
      ? rows.filter((r) => r.posicion === 1).map((r) => r.id)
      : [],
    politicaEmpates: rubric.politicaEmpates,
  };
}
