import mongoose from "mongoose";
import { Participant } from "../../competition-models.js";
import { User, Institution } from "../../models.js";

import { ApiError, normalize, text } from "../../validation.js";

let operationQueue = Promise.resolve();
// Una plantilla contiene participantes existentes y únicos, no identificadores de cuentas de usuario.
export async function members(ids, active = true) {
  if (!Array.isArray(ids) || ids.length > 100)
    throw new ApiError(400, "Revisa los integrantes del equipo.");
  const parsed = ids.map((value) => id(value, "integrante"));
  if (new Set(parsed).size !== parsed.length)
    throw new ApiError(400, "No repitas integrantes en el equipo.");
  return Promise.all(
    parsed.map((value) =>
      reference(Participant, value, "El participante", active),
    ),
  );
}
// Validadores y autorización comunes. Las reglas de cada recurso viven en su propio módulo.
export function competitionWrite(operation) {
  const result = operationQueue.then(operation);
  operationQueue = result.catch(() => {});
  return result;
}

export function id(value, field = "referencia") {
  if (!mongoose.isObjectIdOrHexString(value))
    throw new ApiError(400, `Revisa ${field}: identificador inválido.`);
  return String(value).toLowerCase();
}

export function integer(value, field, min, max) {
  if (
    !["number", "string"].includes(typeof value) ||
    value === "" ||
    !Number.isInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  ) {
    throw new ApiError(
      400,
      `${field} debe ser un entero entre ${min} y ${max}.`,
    );
  }
  return Number(value);
}

export function choice(value, choices, field) {
  if (!choices.includes(value))
    throw new ApiError(400, `Selecciona ${field} válido.`);
  return value;
}

export function strings(values, field, minimum = 1, maximum = 30) {
  if (
    !Array.isArray(values) ||
    values.length < minimum ||
    values.length > maximum
  )
    throw new ApiError(400, `Revisa ${field}.`);
  const result = values.map((value) => text(value, field, 150, 1));
  if (new Set(result.map(normalize)).size !== result.length)
    throw new ApiError(400, `${field} contiene valores duplicados.`);
  return result;
}

export function timestamp(value, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
      .toISOString()
      .slice(0, 10) !== value.slice(0, 10)
  )
    throw new ApiError(400, `Revisa la fecha de ${field}.`);
  return new Date(value);
}

export function activeState(value = "activo") {
  return choice(value, ["activo", "inactivo"], "un estado");
}

export function optionalText(value, field, max = 2000) {
  return value === undefined || value === "" ? "" : text(value, field, max);
}

export async function reference(Model, value, label, active = true) {
  const record = await Model.findById(id(value, label));
  if (!record) throw new ApiError(400, `${label} no existe.`, "REFERENCE");
  if (active && record.estado !== "activo")
    throw new ApiError(
      400,
      `${label} debe estar activo.`,
      "INACTIVE_REFERENCE",
    );
  return record;
}

export async function refreshActor(req) {
  const actor = await User.findById(req.user._id).select("+authVersion");
  if (
    !actor ||
    actor.estado !== "activo" ||
    (actor.authVersion || 0) !== (req.session.authVersion || 0)
  )
    throw new ApiError(401, "Inicia sesión para continuar.", "UNAUTHENTICATED");
  req.user = actor;
  return actor;
}

export function requireRoles(user, roles) {
  if (!roles.includes(user.rol))
    throw new ApiError(
      403,
      "No tienes permiso para realizar esta operación.",
      "FORBIDDEN",
    );
}

export function managesEvent(user, event) {
  return (
    user.rol === "administrador" ||
    (user.rol === "organizador" &&
      String(event.responsable) === String(user._id))
  );
}

export function readableEvent(user, event) {
  if (event.estado === "borrador" && !managesEvent(user, event))
    throw new ApiError(403, "Este evento aún no está publicado.", "FORBIDDEN");
}

export function ownsRecord(user, record) {
  return (
    user.rol === "administrador" ||
    String(record.creadoPor) === String(user._id) ||
    String(record.responsable) === String(user._id)
  );
}

export function ageOn(birth, date) {
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (
    date.getUTCMonth() < birth.getUTCMonth() ||
    (date.getUTCMonth() === birth.getUTCMonth() &&
      date.getUTCDate() < birth.getUTCDate())
  )
    age--;
  return age;
}

export async function eligible(participant, rules, date, institution) {
  const age = ageOn(participant.nacimiento, date);
  if (
    (rules.edadMin !== null && age < rules.edadMin) ||
    (rules.edadMax !== null && age > rules.edadMax)
  )
    throw new ApiError(
      400,
      `${participant.nombre} no cumple la edad de la categoría.`,
      "ELIGIBILITY",
    );
  if (rules.genero !== "cualquiera" && participant.genero !== rules.genero)
    throw new ApiError(
      400,
      `${participant.nombre} no cumple la categoría de género.`,
      "ELIGIBILITY",
    );
  if (institution && String(participant.institucion) !== String(institution))
    throw new ApiError(
      400,
      "Todos los integrantes deportivos deben pertenecer a la institución del equipo.",
      "ELIGIBILITY",
    );
  await reference(
    Institution,
    participant.institucion,
    "La institución del participante",
  );
  await reference(User, participant.usuario, "La cuenta del participante");
}

export function approval(value = false) {
  if (typeof value !== "boolean")
    throw new ApiError(
      400,
      "La política del evento debe ser un valor booleano.",
    );
  return value;
}
