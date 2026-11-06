import { Venue, Competition } from "../workflow/models.js";
import { Discipline } from "../../competition-models.js";
import {
  ensure,
  formFields,
  text,
  number,
  date,
  id,
  requireRoles,
} from "../workflow/common.js";

/** Valida compatibilidad, recursos y franjas de disponibilidad antes de guardar una instalación. */
export async function venueInput(body) {
  formFields(body, [
    "nombre",
    "tipo",
    "ubicacion",
    "capacidad",
    "disciplinas",
    "recursos",
    "disponibilidad",
    "estado",
  ]);
  ensure(
    ["cancha", "coliseo", "pista", "piscina", "otro"].includes(body.tipo),
    "Selecciona un tipo de instalación.",
  );
  ensure(
    Array.isArray(body.disciplinas) && body.disciplinas.length > 0,
    "Selecciona al menos una disciplina compatible.",
  );
  const disciplinas = [...new Set(body.disciplinas.map((x) => id(x)))];
  ensure(
    (await Discipline.countDocuments({
      _id: { $in: disciplinas },
      estado: "activo",
    })) === disciplinas.length,
    "Todas las disciplinas deben existir y estar activas.",
  );
  ensure(
    Array.isArray(body.recursos || []) && (body.recursos || []).length <= 100,
    "Los recursos deben ser una lista de hasta 100 elementos.",
  );
  ensure(
    Array.isArray(body.disponibilidad || []) &&
      (body.disponibilidad || []).length <= 100,
    "La disponibilidad debe ser una lista de hasta 100 franjas.",
  );
  const recursos = (body.recursos || []).map((r) => {
    formFields(r, ["nombre", "capacidad", "id"]);
    return {
      nombre: text(r.nombre, "recurso", 80, 1),
      capacidad: number(r.capacidad, "capacidad del recurso", 1, 100000),
    };
  });
  ensure(
    new Set(recursos.map((r) => r.nombre)).size === recursos.length,
    "No repitas nombres de recursos.",
  );
  const disponibilidad = (body.disponibilidad || []).map((slot) => {
    formFields(slot, ["inicio", "fin", "id"]);
    const inicio = date(slot.inicio, "disponibilidad"),
      fin = date(slot.fin, "disponibilidad");
    ensure(
      inicio < fin,
      "La disponibilidad debe tener inicio anterior al fin.",
    );
    return { inicio, fin };
  });
  ensure(
    ["activo", "inactivo"].includes(body.estado || "activo"),
    "Estado de escenario inválido.",
  );
  return {
    nombre: text(body.nombre, "nombre", 120, 2),
    tipo: body.tipo,
    ubicacion: text(body.ubicacion, "ubicación", 200, 2),
    capacidad: number(body.capacidad, "capacidad", 1, 100000),
    disciplinas,
    recursos,
    disponibilidad,
    estado: body.estado || "activo",
  };
}
/** Protege las reservas existentes cuando cambian capacidad, horarios o disciplinas del escenario. */
export async function saveVenue(user, body, previous) {
  requireRoles(user, ["administrador", "organizador"]);
  ensure(
    !previous ||
      user.rol === "administrador" ||
      String(previous.creadoPor) === String(user._id),
    "Solo el responsable puede editar este escenario.",
    403,
  );
  const data = await venueInput(body);
  if (previous) {
    const upcoming = await Competition.find({
      escenario: previous._id,
      estado: { $in: ["programada", "reprogramada"] },
    });
    // Las reservas ya programadas deben seguir cabiendo en la disponibilidad y recursos editados.
    ensure(
      !upcoming.some(
        (c) =>
          (data.disponibilidad.length &&
            !data.disponibilidad.some(
              (s) => s.inicio <= c.inicio && s.fin >= c.fin,
            )) ||
          c.personas.length > data.capacidad ||
          c.recursos.some((r) => !data.recursos.some((n) => n.nombre === r)),
      ),
      "La modificación dejaría reservas programadas sin recursos u horario.",
      409,
    );
    const events = await Promise.all(
      upcoming.map((c) => c.populate("torneo", "disciplina")),
    );
    ensure(
      events.every((c) =>
        data.disciplinas.includes(String(c.torneo.disciplina)),
      ),
      "No retires una disciplina con reservas programadas.",
      409,
    );
    Object.assign(previous, data);
    await previous.save();
    return previous;
  }
  return Venue.create({ ...data, creadoPor: user._id });
}
