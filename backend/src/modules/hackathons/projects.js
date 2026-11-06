import {
  Project,
  HackRegistration,
  Assignment,
  Evaluation,
} from "../workflow/models.js";
import { Team } from "../../competition-models.js";
import {
  ensure,
  formFields,
  text,
  id,
  eventFor,
  managesEvent,
  windowOpen,
  audit,
  plain,
} from "../workflow/common.js";

/** Autoriza por evento, representación del equipo o asignación activa de jurado; no confía en el ID recibido. */
export async function projectAccess(user, project, write = false) {
  const event = await eventFor(user, "hackatones", project.hackaton);
  if (managesEvent(user, event)) return event;
  if (!write && user.rol === "jurado") {
    ensure(
      project.estado === "entregado" &&
        (await Assignment.exists({
          proyecto: project._id,
          jurado: user._id,
          activo: true,
        })),
      "No tienes asignado este proyecto.",
      403,
    );
    return event;
  }
  const team = await Team.findById(project.equipo);
  const registration = await HackRegistration.findById(
    project.inscripcion,
  ).populate("plantilla.participante", "usuario");
  ensure(
    team &&
      registration?.estado === "confirmada" &&
      (String(team.responsable) === String(user._id) ||
        (!write &&
          registration.plantilla.some(
            (p) => String(p.participante?.usuario) === String(user._id),
          ))),
    "No tienes acceso a este proyecto.",
    403,
  );
  return event;
}
function link(value, label) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    ensure(false, `El enlace de ${label} no es válido.`);
  }
  ensure(
    ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password,
    `Usa un enlace HTTP o HTTPS de ${label}.`,
  );
  return url.href;
}
/** Solo equipos inscritos y dentro de la ventana preparan borradores. Editar una entrega exige presentarla otra vez. */
export async function saveProject(req, previous) {
  formFields(req.body, [
    "hackaton",
    "equipo",
    "nombre",
    "categoria",
    "descripcion",
    "repositorio",
    "demostracion",
  ]);
  const body = { ...(previous ? plain(previous) : {}), ...req.body };
  const event = previous
    ? await projectAccess(req.user, previous, true)
    : await eventFor(req.user, "hackatones", body.hackaton);
  windowOpen(event, "entrega", "entregaInicio", "entregaFin");
  const team = await Team.findById(id(previous?.equipo || body.equipo));
  ensure(
    team &&
      (managesEvent(req.user, event) ||
        String(team.responsable) === String(req.user._id)),
    "No representas al equipo.",
    403,
  );
  const registration = await HackRegistration.findOne({
    hackaton: event._id,
    equipo: team._id,
    estado: "confirmada",
  });
  ensure(registration, "El equipo necesita una inscripción confirmada.", 409);
  ensure(
    !previous ||
      (String(body.hackaton) === String(previous.hackaton) &&
        String(body.equipo) === String(previous.equipo)),
    "No puedes trasladar un proyecto a otro equipo o evento.",
  );
  ensure(
    previous ||
      (await Project.countDocuments({
        hackaton: event._id,
        equipo: team._id,
      })) < event.proyectosPorEquipo,
    "El equipo alcanzó su límite de proyectos.",
    409,
  );
  ensure(
    event.categorias.includes(body.categoria),
    "Categoría tecnológica inválida.",
  );
  const data = {
    hackaton: event._id,
    equipo: team._id,
    inscripcion: registration._id,
    nombre: text(body.nombre, "nombre", 150, 2),
    categoria: body.categoria,
    descripcion: body.descripcion
      ? text(body.descripcion, "descripción", 5000)
      : "",
    repositorio: link(body.repositorio, "repositorio"),
    demostracion: link(body.demostracion, "demostración"),
  };
  audit(req, "hackatones", event, previous);
  if (previous) {
    ensure(
      !(await Evaluation.exists({ proyecto: previous._id })),
      "Ya hay evaluaciones asociadas a esta presentación.",
      409,
    );
    Object.assign(previous, data);
    previous.version++;
    // Editar una entrega vuelve a borrador: no se sustituye silenciosamente lo que verán los jurados.
    previous.estado = "borrador";
    await previous.save();
    return previous;
  }
  return Project.create({ ...data, creadoPor: req.user._id });
}
/** Conserva una fotografía de la versión entregada; los jurados no evalúan borradores. */
export async function deliverProject(req, project) {
  formFields(req.body, []);
  const event = await projectAccess(req.user, project, true);
  windowOpen(event, "entrega", "entregaInicio", "entregaFin");
  ensure(
    await HackRegistration.exists({
      _id: project.inscripcion,
      estado: "confirmada",
    }),
    "La inscripción ya no está confirmada.",
    409,
  );
  ensure(
    project.descripcion?.trim().length >= 20,
    "Completa una descripción de al menos 20 caracteres.",
  );
  ensure(
    !event.requiereRepositorio || project.repositorio,
    "El evento exige el enlace de repositorio.",
  );
  ensure(
    !event.requiereDemostracion || project.demostracion,
    "El evento exige el enlace de demostración.",
  );
  ensure(project.estado === "borrador", "El proyecto ya fue entregado.", 409);
  audit(req, "hackatones", event, project);
  project.estado = "entregado";
  project.entregadoEn = new Date();
  project.presentacion = {
    version: project.version,
    nombre: project.nombre,
    categoria: project.categoria,
    descripcion: project.descripcion,
    repositorio: project.repositorio,
    demostracion: project.demostracion,
  };
  await project.save();
  return project;
}
