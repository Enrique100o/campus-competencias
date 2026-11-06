import { Venue, Competition, Result } from "../workflow/models.js";
import { Registration, Team, Participant } from "../../competition-models.js";
import {
  ensure,
  formFields,
  number,
  date,
  id,
  eventFor,
  audit,
  reason,
  plain,
} from "../workflow/common.js";

// Solo se usan nombres y la plantilla confirmada en agenda/resultados: nunca documentos de identidad.
/** Programa o reprograma con inscripciones confirmadas. Comprueba cruces del escenario, competidores e integrantes. */
export async function scheduleCompetition(req, previous) {
  const input = formFields(req.body, [
    "torneo",
    "tipo",
    "fase",
    "grupo",
    "prueba",
    "escenario",
    "inicio",
    "fin",
    "participaciones",
    "recursos",
    "obligatoria",
    "estado",
    "motivo",
  ]);
  const body = { ...(previous ? plain(previous) : {}), ...input };
  const event = await eventFor(
    req.user,
    "torneos",
    previous?.torneo || body.torneo,
    true,
  );
  ensure(
    ["inscripciones", "en_curso"].includes(event.estado),
    "El torneo no admite programación en esta etapa.",
    409,
  );
  if (previous) {
    reason(input);
    ensure(
      !(await Result.exists({ competencia: previous._id })),
      "No reprogrames una competencia con resultados; corrige el resultado mediante su procedimiento.",
      409,
    );
    audit(req, "torneos", event, previous, input.motivo);
    if (input.estado === "cancelada") {
      previous.estado = "cancelada";
      previous.motivo = input.motivo;
      await previous.save();
      return previous;
    }
  } else
    ensure(
      !body.estado || body.estado === "programada",
      "Estado inicial inválido.",
    );
  ensure(
    ["partido", "prueba", "ronda"].includes(body.tipo),
    "Tipo de competencia inválido.",
  );
  ensure(
    event.reglamento.fases.includes(body.fase),
    "La fase debe estar en el reglamento.",
  );
  const inicio = date(body.inicio, "inicio"),
    fin = date(body.fin, "fin");
  ensure(
    inicio < fin && inicio >= event.inicio && fin <= event.fin,
    "El horario debe quedar dentro de las fechas del torneo.",
  );
  const venue = await Venue.findById(id(body.escenario, "escenario"));
  ensure(
    venue?.estado === "activo" &&
      venue.disciplinas.some((d) => String(d) === String(event.disciplina)),
    "El escenario debe estar activo y ser compatible.",
  );
  ensure(
    !venue.disponibilidad.length ||
      venue.disponibilidad.some(
        (slot) => slot.inicio <= inicio && slot.fin >= fin,
      ),
    "El horario no está dentro de la disponibilidad del escenario.",
  );
  ensure(
    Array.isArray(body.participaciones) && body.participaciones.length > 0,
    "Agrega participantes inscritos.",
  );
  ensure(
    body.tipo !== "partido" || body.participaciones.length === 2,
    "Un partido necesita dos rivales distintos.",
  );
  const ids = body.participaciones.map((p) => id(p.inscripcion));
  ensure(new Set(ids).size === ids.length, "No repitas competidores.");
  const registrations = await Registration.find({
    _id: { $in: ids },
    torneo: event._id,
    estado: "confirmada",
  });
  ensure(
    registrations.length === ids.length,
    "Todos los competidores deben tener una inscripción confirmada en este torneo.",
  );
  const prueba = body.prueba || "";
  ensure(
    event.reglamento.pruebas.length
      ? event.reglamento.pruebas.includes(prueba)
      : !prueba,
    "Prueba no configurada en el reglamento.",
  );
  ensure(
    registrations.every((r) => r.prueba === prueba),
    "Las inscripciones deben pertenecer a la prueba programada.",
  );
  const people = [
    ...new Set(
      registrations.flatMap((r) =>
        r.plantilla.map((p) => String(p.participante)),
      ),
    ),
  ];
  ensure(
    people.length === registrations.reduce((n, r) => n + r.plantilla.length, 0),
    "Una persona no puede competir contra sí misma.",
  );
  ensure(
    people.length <= venue.capacidad,
    "La instalación no tiene capacidad suficiente.",
  );
  const resources = body.recursos || [];
  ensure(
    Array.isArray(resources) &&
      new Set(resources).size === resources.length &&
      resources.every((r) => venue.recursos.some((v) => v.nombre === r)),
    "Recursos de escenario inválidos.",
  );
  const occupiedLanes = new Set();
  const participaciones = [];
  for (const item of body.participaciones) {
    formFields(item, [
      "inscripcion",
      "competidor",
      "nombre",
      "carril",
      "serie",
      "posicion",
      "id",
    ]);
    const registration = registrations.find(
      (r) => String(r._id) === item.inscripcion,
    );
    const competitor = await (
      registration.modalidad === "individual" ? Participant : Team
    ).findById(registration.competidor);
    ensure(competitor, "Competidor no disponible.");
    if (item.carril) {
      ensure(
        resources.includes(item.carril),
        "El carril debe estar reservado como recurso del escenario.",
      );
      const laneKey = `${item.serie || ""}:${item.carril}`;
      ensure(
        !occupiedLanes.has(laneKey),
        "No asignes dos competidores al mismo carril y serie.",
      );
      occupiedLanes.add(laneKey);
      const slot = venue.recursos.find((r) => r.nombre === item.carril);
      ensure(
        registration.plantilla.length <= slot.capacidad,
        "El recurso no admite tantos integrantes.",
      );
    }
    participaciones.push({
      inscripcion: registration._id,
      competidor: registration.competidor,
      nombre: competitor.nombre,
      carril: item.carril || "",
      serie: item.serie || "",
      posicion: item.posicion || "",
    });
  }
  const overlap = await Competition.exists({
    _id: { $ne: previous?._id },
    estado: { $ne: "cancelada" },
    inicio: { $lt: fin },
    fin: { $gt: inicio },
    $or: [
      { escenario: venue._id },
      { personas: { $in: people } },
      {
        "participaciones.competidor": {
          $in: registrations.map((r) => r.competidor),
        },
      },
    ],
  });
  ensure(
    !overlap,
    "El horario se cruza con una reserva del escenario o de los competidores/integrantes.",
    409,
  );
  const data = {
    torneo: event._id,
    tipo: body.tipo,
    fase: body.fase,
    grupo: body.grupo || "",
    prueba,
    escenario: venue._id,
    inicio,
    fin,
    participaciones,
    personas: people,
    recursos: resources,
    obligatoria: body.obligatoria !== false,
    estado: previous ? "reprogramada" : "programada",
    motivo: input.motivo || "",
  };
  if (previous) {
    Object.assign(previous, data);
    await previous.save();
    return previous;
  }
  audit(req, "torneos", event, null);
  return Competition.create({ ...data, creadoPor: req.user._id });
}

function scoreEntries(body, competition, event) {
  ensure(
    Array.isArray(body.marcas) &&
      body.marcas.length === competition.participaciones.length,
    "Registra una marca o estado para cada competidor.",
  );
  const ids = competition.participaciones.map((p) => String(p.inscripcion));
  const seen = new Set();
  const marks = body.marcas.map((m) => {
    formFields(m, ["inscripcion", "valor", "estado", "desempate", "id"]);
    const key = id(m.inscripcion);
    ensure(
      ids.includes(key) && !seen.has(key),
      "Las marcas no corresponden a competidores distintos de esta competencia.",
    );
    seen.add(key);
    const state = m.estado || "valido";
    ensure(
      ["valido", "descalificado", "no_presentacion", "abandono"].includes(
        state,
      ),
      "Estado de resultado inválido.",
    );
    let value = null,
      tie = null;
    if (state === "valido") {
      value = number(m.valor, "resultado");
      const factor = 10 ** event.reglamento.precision;
      ensure(
        Math.abs(value * factor - Math.round(value * factor)) < 1e-6,
        `La métrica admite ${event.reglamento.precision} decimales.`,
      );
      ensure(
        event.reglamento.metrica !== "tiempo" || value > 0,
        "El tiempo debe ser mayor que cero.",
      );
      if (
        m.desempate !== undefined &&
        m.desempate !== null &&
        m.desempate !== ""
      )
        tie = number(m.desempate, "desempate");
    } else
      ensure(
        m.valor === undefined || m.valor === null || m.valor === "",
        "Una descalificación, ausencia o abandono no lleva marca numérica.",
      );
    return { inscripcion: key, valor: value, desempate: tie, estado: state };
  });
  const direction = event.reglamento.orden === "ascendente" ? 1 : -1;
  const valid = marks
    .filter((m) => m.estado === "valido")
    .sort(
      (a, b) =>
        direction * (a.valor - b.valor) ||
        (b.desempate ?? -1) - (a.desempate ?? -1),
    );
  const same = (a, b) => a.valor === b.valor && a.desempate === b.desempate;
  const winners = valid.filter((m) => same(m, valid[0]));
  ensure(
    !(
      competition.tipo === "partido" &&
      event.formato === "eliminacion" &&
      winners.length > 1
    ),
    "Una eliminación necesita un desempate numérico para resolver el ganador.",
  );
  let position = 0;
  const posiciones = valid.map((m, index) => {
    if (index === 0 || !same(m, valid[index - 1])) position = index + 1;
    return { inscripcion: m.inscripcion, posicion: position };
  });
  return {
    marcas: marks,
    posiciones,
    ganadores: winners.map((m) => m.inscripcion),
    empate: winners.length > 1,
  };
}

/** Guarda un único resultado vigente y exige motivo para corregirlo; impide invalidar rondas posteriores. */
export async function saveResult(req, previous) {
  formFields(req.body, ["competencia", "marcas", "motivo"]);
  const competition = await Competition.findById(
    id(previous?.competencia || req.body.competencia),
  );
  ensure(competition, "Competencia inexistente.", 404);
  const event = await eventFor(req.user, "torneos", competition.torneo, true);
  ensure(
    event.estado === "en_curso" &&
      Date.now() >= event.inicio &&
      Date.now() <= event.fin,
    "Los resultados solo se registran durante el torneo en curso.",
    409,
  );
  ensure(
    competition.estado !== "cancelada",
    "Una competencia cancelada no admite resultados.",
    409,
  );
  ensure(
    Date.now() >= competition.inicio,
    "La competencia todavía no ha comenzado.",
    409,
  );
  const existent = await Result.findOne({ competencia: competition._id });
  ensure(
    previous || !existent,
    "Esta competencia ya tiene un resultado; utiliza su corrección.",
    409,
  );
  if (previous) {
    reason(req.body);
    const phase = event.reglamento.fases.indexOf(competition.fase);
    const nextPhases = event.reglamento.fases.slice(phase + 1);
    ensure(
      !(await Competition.exists({
        torneo: event._id,
        fase: { $in: nextPhases },
        estado: { $ne: "cancelada" },
      })),
      "Cancela con motivo las rondas posteriores afectadas antes de corregir este resultado.",
      409,
    );
  }
  const data = scoreEntries(req.body, competition, event);
  audit(req, "torneos", event, previous, req.body.motivo || "");
  let result;
  if (previous) {
    Object.assign(previous, data, {
      autor: req.user._id,
      motivo: req.body.motivo,
    });
    previous.version++;
    await previous.save();
    result = previous;
  } else
    result = await Result.create({
      ...data,
      competencia: competition._id,
      torneo: event._id,
      autor: req.user._id,
      reglamentoVersion: event.reglamentoVersion,
    });
  competition.estado = "finalizada";
  await competition.save();
  return result;
}

const classificationDefaults = {
  victoria: 3,
  empate: 1,
  derrota: 0,
  avanzan: 2,
  criterios: ["puntos", "diferencia", "aFavor"],
  agregacion: "mejor",
};
/** Recalcula desde los resultados vigentes: una corrección nunca suma puntos dos veces. Agrupa por fase, prueba y grupo. */
export async function standings(event, filters = {}) {
  const query = { torneo: event._id, estado: { $ne: "cancelada" } };
  for (const field of ["fase", "prueba", "grupo"])
    if (filters[field]) query[field] = filters[field];
  const competitions = await Competition.find(query).sort({ inicio: 1 });
  const results = await Result.find({
    competencia: { $in: competitions.map((c) => c._id) },
  });
  const rules = {
    ...classificationDefaults,
    ...(event.reglamento.clasificacion?.toObject?.() ||
      event.reglamento.clasificacion ||
      {}),
  };
  const grouped = new Map();
  for (const competition of competitions) {
    const key = JSON.stringify([
      competition.fase,
      competition.prueba || "",
      competition.grupo || "",
    ]);
    if (!grouped.has(key))
      grouped.set(key, {
        fase: competition.fase,
        prueba: competition.prueba || "",
        grupo: competition.grupo || "",
        rows: new Map(),
        pendientes: 0,
      });
    const group = grouped.get(key),
      result = results.find(
        (r) => String(r.competencia) === String(competition._id),
      );
    if (!result) group.pendientes++;
    for (const entry of competition.participaciones) {
      const id = String(entry.inscripcion);
      if (!group.rows.has(id))
        group.rows.set(id, {
          inscripcion: id,
          competidor: String(entry.competidor),
          nombre: entry.nombre,
          jugados: 0,
          victorias: 0,
          empates: 0,
          derrotas: 0,
          puntos: 0,
          aFavor: 0,
          enContra: 0,
          diferencia: 0,
          marcas: [],
          incidencias: [],
        });
      if (!result) continue;
      const row = group.rows.get(id),
        mark = result.marcas.find((m) => String(m.inscripcion) === id);
      row.jugados++;
      if (mark.estado !== "valido") row.incidencias.push(mark.estado);
      else row.marcas.push(mark.valor);
      if (competition.tipo === "partido") {
        const other = result.marcas.find((m) => String(m.inscripcion) !== id);
        if (mark.estado === "valido") row.aFavor += mark.valor;
        if (other.estado === "valido") row.enContra += other.valor;
        const won = result.ganadores.some((w) => String(w) === id);
        if (mark.estado === "valido" && won && !result.empate) {
          row.victorias++;
          row.puntos += rules.victoria;
        } else if (mark.estado === "valido" && won && result.empate) {
          row.empates++;
          row.puntos += rules.empate;
        } else {
          row.derrotas++;
          row.puntos += rules.derrota;
        }
        row.diferencia = row.aFavor - row.enContra;
      }
    }
  }
  const grupos = [];
  for (const group of grouped.values()) {
    const qualifyCount =
      group.fase === event.reglamento.fases.at(-1) ? 1 : rules.avanzan;
    const matchFormat = competitions.some(
      (c) =>
        c.fase === group.fase &&
        (c.prueba || "") === group.prueba &&
        (c.grupo || "") === group.grupo &&
        c.tipo === "partido",
    );
    const rows = [...group.rows.values()].map((r) => ({
      ...r,
      marca: r.marcas.length
        ? rules.agregacion === "suma"
          ? r.marcas.reduce((a, b) => a + b, 0)
          : rules.agregacion === "promedio"
            ? r.marcas.reduce((a, b) => a + b, 0) / r.marcas.length
            : event.reglamento.orden === "ascendente"
              ? Math.min(...r.marcas)
              : Math.max(...r.marcas)
        : null,
    }));
    const criteria = matchFormat ? rules.criterios : ["marca"];
    const compare = (a, b) => {
      if (!matchFormat && (a.marca === null || b.marca === null))
        return a.marca === b.marca ? 0 : a.marca === null ? 1 : -1;
      for (const key of criteria) {
        const diff = (b[key] ?? 0) - (a[key] ?? 0);
        if (diff)
          return !matchFormat && event.reglamento.orden === "ascendente"
            ? -diff
            : diff;
      }
      return 0;
    };
    rows.sort(compare);
    rows.forEach((row, i) => {
      row.posicion =
        i && compare(row, rows[i - 1]) === 0 ? rows[i - 1].posicion : i + 1;
      row.empate = Boolean(
        (i && compare(row, rows[i - 1]) === 0) ||
        (i + 1 < rows.length && compare(row, rows[i + 1]) === 0),
      );
      row.clasificado =
        group.pendientes === 0 &&
        row.jugados > 0 &&
        (matchFormat || row.marca !== null) &&
        row.posicion <= qualifyCount &&
        !(
          row.empate &&
          rows.filter((r) => compare(row, r) === 0).length + row.posicion - 1 >
            qualifyCount
        );
    });
    grupos.push({
      fase: group.fase,
      prueba: group.prueba,
      grupo: group.grupo,
      pendientes: group.pendientes,
      clasifican: qualifyCount,
      tabla: rows,
    });
  }
  return {
    torneo: String(event._id),
    metrica: event.reglamento.metrica,
    unidad: event.reglamento.unidad,
    precision: event.reglamento.precision,
    orden: event.reglamento.orden,
    grupos,
  };
}

/** Expone horarios y nombres de participación sin incluir documentos de identidad ni fechas de nacimiento. */
export async function sportsAgenda(user, event, filters = {}) {
  const query = { torneo: event._id };
  if (filters.fecha) {
    ensure(
      /^\d{4}-\d{2}-\d{2}$/.test(filters.fecha),
      "Fecha de filtro inválida.",
    );
    const start = new Date(`${filters.fecha}T00:00:00-05:00`);
    query.inicio = { $gte: start, $lt: new Date(+start + 86400000) };
  }
  if (filters.competidor)
    query["participaciones.competidor"] = id(filters.competidor);
  if (filters.participante) query.personas = id(filters.participante);
  if (filters.disciplina && id(filters.disciplina) !== String(event.disciplina))
    return [];
  return Competition.find(query)
    .select("-personas")
    .populate("escenario", "nombre ubicacion tipo")
    .sort({ inicio: 1, _id: 1 });
}
