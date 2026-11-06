import { HackRegistration, Project, Competition } from "../workflow/models.js";
import { Team, Participant } from "../../competition-models.js";
import { Institution, User } from "../../models.js";
import {
  ensure,
  formFields,
  eventFor,
  managesEvent,
  reference,
  activeRegistrations,
  windowOpen,
  reason,
  audit,
} from "../workflow/common.js";

export async function represents(user, team) {
  return (
    user.rol === "administrador" ||
    String(team.responsable) === String(user._id)
  );
}
/** Reserva cupo y fotografía de la plantilla. La cola de escritura evita exceder el último cupo simultáneamente. */
export async function registerHackathon(req) {
  const body = formFields(req.body, ["hackaton", "equipo"]);
  const event = await eventFor(req.user, "hackatones", body.hackaton);
  const team = await reference(Team, body.equipo, "El equipo");
  ensure(
    (await represents(req.user, team)) || managesEvent(req.user, event),
    "No representas al equipo ni gestionas el evento.",
    403,
  );
  windowOpen(event, "inscripciones", "inscripcionInicio", "inscripcionFin");
  ensure(
    team.tipo === "tecnologico" && String(team.hackaton) === String(event._id),
    "El equipo no corresponde a este hackatón.",
  );
  ensure(
    team.integrantes.length >= event.integrantesMin &&
      team.integrantes.length <= event.integrantesMax,
    "La plantilla no cumple el tamaño del evento.",
  );
  const people = await Participant.find({
    _id: { $in: team.integrantes },
    estado: "activo",
  });
  ensure(
    people.length === team.integrantes.length,
    "Hay integrantes inexistentes o inactivos.",
  );
  for (const person of people) {
    await reference(User, person.usuario, "La cuenta");
    await reference(Institution, person.institucion, "La institución");
  }
  const previous = await HackRegistration.findOne({
    hackaton: event._id,
    equipo: team._id,
  });
  ensure(
    !previous || !activeRegistrations.includes(previous.estado),
    "El equipo ya tiene una inscripción activa.",
    409,
  );
  ensure(
    (await HackRegistration.countDocuments({
      hackaton: event._id,
      estado: { $in: activeRegistrations },
    })) < event.cupos,
    "No quedan cupos.",
    409,
  );
  ensure(
    !(await HackRegistration.exists({
      hackaton: event._id,
      equipo: { $ne: team._id },
      estado: { $in: activeRegistrations },
      "plantilla.participante": { $in: team.integrantes },
    })),
    "Un integrante ya está inscrito con otro equipo.",
    409,
  );
  const data = {
    hackaton: event._id,
    equipo: team._id,
    creadoPor: req.user._id,
    estado: event.requiereAprobacion ? "pendiente" : "confirmada",
    motivo: "",
    plantilla: people.map((p) => ({
      participante: p._id,
      nombre: p.nombre,
      institucion: p.institucion,
    })),
  };
  audit(req, "hackatones", event, previous);
  if (previous) {
    Object.assign(previous, data);
    await previous.save();
    return previous;
  }
  return HackRegistration.create(data);
}

/** Aprobar, rechazar y retirar conservan el documento y su historial; solo los estados activos consumen cupos. */
export async function manageRegistration(req, kind, record) {
  const body = formFields(req.body, ["estado", "motivo"]);
  const event = await eventFor(
    req.user,
    kind,
    kind === "torneos" ? record.torneo : record.hackaton,
  );
  const owner = managesEvent(req.user, event);
  let representative = String(record.creadoPor) === String(req.user._id);
  if (kind === "torneos") {
    if (record.modalidad === "individual")
      representative ||= Boolean(
        await Participant.exists({
          _id: record.competidor,
          usuario: req.user._id,
        }),
      );
    else
      representative ||= Boolean(
        await Team.exists({
          _id: record.competidor,
          responsable: req.user._id,
        }),
      );
  } else
    representative ||= Boolean(
      await Team.exists({ _id: record.equipo, responsable: req.user._id }),
    );
  ensure(owner || representative, "No puedes gestionar esta inscripción.", 403);
  ensure(
    activeRegistrations.includes(record.estado),
    "Esta inscripción ya está cerrada.",
    409,
  );
  const requested = body.estado;
  ensure(
    ["confirmada", "rechazada", "cancelada"].includes(requested),
    "Estado solicitado inválido.",
  );
  ensure(
    event.estado === "inscripciones" && Date.now() <= event.inscripcionFin,
    "El plazo de cambios de inscripción está cerrado.",
    409,
  );
  if (requested === "cancelada") reason(body);
  else {
    ensure(
      owner && record.estado === "pendiente",
      "Solo el organizador puede resolver solicitudes pendientes.",
      403,
    );
    if (requested === "rechazada") reason(body);
  }
  if (kind === "torneos")
    ensure(
      !(await Competition.exists({
        estado: { $ne: "cancelada" },
        "participaciones.inscripcion": record._id,
      })),
      "La inscripción ya tiene competencias programadas.",
      409,
    );
  else
    ensure(
      !(await Project.exists({ inscripcion: record._id, estado: "entregado" })),
      "El equipo ya entregó un proyecto; conserva la inscripción.",
      409,
    );
  audit(req, kind, event, record, body.motivo || "");
  record.estado = requested;
  record.motivo = body.motivo || "";
  await record.save();
  return record;
}
