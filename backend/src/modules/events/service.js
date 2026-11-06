import {
  Competition,
  Rubric,
  Project,
  Evaluation,
} from "../workflow/models.js";
import { Registration, Participant } from "../../competition-models.js";
import { eventDates } from "./input.js";
import { eligible } from "../shared/access.js";
import { standings } from "../sports/service.js";
import { hackathonReport } from "../hackathons/evaluations.js";
import {
  ensure,
  formFields,
  eventFor,
  reason,
  audit,
} from "../workflow/common.js";

/** Las etapas habilitan operaciones reales: las fechas por sí solas no publican ni cierran un evento. */
export async function changeStage(req, kind, value) {
  formFields(req.body, ["estado", "motivo"]);
  const event = await eventFor(req.user, kind, value, true),
    next = req.body.estado;
  const from = event.estado;
  ensure(from !== next, "El evento ya está en esa etapa.", 409);
  const transitions =
    kind === "torneos"
      ? {
          borrador: ["inscripciones", "cancelado"],
          inscripciones: ["en_curso", "cancelado"],
          en_curso: ["finalizado", "cancelado"],
          finalizado: ["en_curso"],
          cancelado: ["inscripciones", "en_curso"],
        }
      : {
          borrador: ["inscripciones", "cancelado"],
          inscripciones: ["entrega", "cancelado"],
          entrega: ["evaluacion", "cancelado"],
          evaluacion: ["publicado", "cancelado"],
          publicado: ["evaluacion"],
          cancelado: ["inscripciones", "entrega", "evaluacion"],
        };
  ensure(
    transitions[from]?.includes(next),
    "Transición de etapa no permitida.",
    409,
  );
  if (
    next === "cancelado" ||
    ["finalizado", "publicado", "cancelado"].includes(from)
  )
    reason(req.body);
  if (next === "inscripciones")
    ensure(
      Date.now() <= event.inscripcionFin,
      "La ventana de inscripción ya cerró; ajusta las fechas con motivo antes de reabrir.",
      409,
    );
  if (next === "en_curso")
    ensure(
      Date.now() >= event.inicio && Date.now() <= event.fin,
      "El torneo aún no comienza o ya terminó.",
      409,
    );
  if (next === "en_curso" && from === "inscripciones")
    ensure(
      await Registration.exists({ torneo: event._id, estado: "confirmada" }),
      "El torneo necesita al menos una inscripción confirmada.",
      409,
    );
  if (next === "entrega")
    ensure(
      Date.now() >= event.entregaInicio && Date.now() <= event.entregaFin,
      "La ventana de entrega no está abierta.",
      409,
    );
  if (next === "evaluacion") {
    ensure(
      Date.now() >= event.evaluacionInicio && Date.now() <= event.evaluacionFin,
      "La ventana de evaluación no está abierta.",
      409,
    );
    ensure(
      await Rubric.exists({ hackaton: event._id }),
      "Configura la rúbrica antes de evaluar.",
      409,
    );
    ensure(
      await Project.exists({ hackaton: event._id, estado: "entregado" }),
      "No hay proyectos entregados para evaluar.",
      409,
    );
  }
  if (next === "finalizado") {
    const competitions = await Competition.find({ torneo: event._id });
    ensure(
      competitions.length > 0,
      "Programa y resuelve las competencias antes del cierre.",
      409,
    );
    ensure(
      competitions
        .filter((c) => c.obligatoria && c.estado !== "cancelada")
        .every((c) => c.estado === "finalizada"),
      "Quedan competencias obligatorias pendientes.",
      409,
    );
    const table = await standings(event);
    ensure(
      table.grupos.some((g) => g.tabla.some((r) => r.jugados > 0)),
      "No hay resultados válidos para publicar.",
      409,
    );
    const finals = table.grupos.filter(
      (g) => g.fase === event.reglamento.fases.at(-1),
    );
    ensure(
      finals.length > 0 &&
        finals.every(
          (g) =>
            g.pendientes === 0 &&
            g.tabla[0]?.jugados > 0 &&
            !g.tabla[0].empate &&
            (g.tabla[0].marca !== null || g.tabla[0].victorias > 0),
        ),
      "Resuelve la fase final y sus empates antes de publicar ganadores.",
      409,
    );
  }
  let publishedReport;
  if (next === "publicado") {
    publishedReport = await hackathonReport(event);
    ensure(
      publishedReport.publicable,
      "Faltan evaluaciones obligatorias o hay un empate sin resolver.",
      409,
    );
  }
  audit(req, kind, event, event, req.body.motivo || "");
  event.estado = next;
  event.motivoEstado = req.body.motivo || "";
  event.publicadoEn = ["finalizado", "publicado"].includes(next)
    ? new Date()
    : undefined;
  if (kind === "hackatones")
    event.reportePublicado = next === "publicado" ? publishedReport : undefined;
  await event.save();
  return event;
}

/** Los cambios de fechas requieren motivo y no pueden dejar reservas ni participantes fuera de las reglas. */
export async function changeDates(req, kind, value) {
  const keys = [
    "inicio",
    "fin",
    "inscripcionInicio",
    "inscripcionFin",
    ...(kind === "hackatones"
      ? ["entregaInicio", "entregaFin", "evaluacionInicio", "evaluacionFin"]
      : []),
  ];
  formFields(req.body, [...keys, "motivo"]);
  reason(req.body);
  const event = await eventFor(req.user, kind, value, true);
  const values = Object.fromEntries(
    keys.map((k) => [k, req.body[k] || event[k].toISOString()]),
  );
  const dates = eventDates(values, kind === "hackatones");
  if (kind === "torneos") {
    const competitions = await Competition.find({
      torneo: event._id,
      estado: { $ne: "cancelada" },
    });
    ensure(
      competitions.every((c) => c.inicio >= dates.inicio && c.fin <= dates.fin),
      "Las nuevas fechas dejarían competencias fuera del torneo.",
      409,
    );
    const registrations = await Registration.find({
      torneo: event._id,
      estado: { $in: ["pendiente", "confirmada"] },
    });
    for (const reg of registrations)
      for (const member of reg.plantilla) {
        const person = await Participant.findById(member.participante);
        ensure(person, "Participante no disponible.");
        await eligible(person, event.reglamento, dates.inicio, reg.institucion);
      }
  } else {
    ensure(
      !(await Evaluation.exists({ hackaton: event._id })) ||
        dates.evaluacionInicio <= new Date(),
      "No desplaces el inicio de evaluaciones ya registradas al futuro.",
      409,
    );
  }
  audit(req, kind, event, event, req.body.motivo);
  Object.assign(event, dates);
  await event.save();
  return event;
}
