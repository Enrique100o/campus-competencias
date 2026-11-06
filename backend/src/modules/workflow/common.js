import { ApiError, formFields, text } from "../../validation.js";
import {
  id,
  managesEvent,
  reference,
  requireRoles,
  readableEvent,
} from "../../competition-service.js";
import {
  Tournament,
  Hackathon,
  resourceJSON,
} from "../../competition-models.js";

export {
  ApiError,
  formFields,
  text,
  id,
  managesEvent,
  reference,
  requireRoles,
  readableEvent,
  resourceJSON,
};
export const activeRegistrations = ["pendiente", "confirmada"];
export const ensure = (condition, message, status = 400) => {
  if (!condition) throw new ApiError(status, message);
};
export const plain = (record) => resourceJSON(record);
export function number(value, label, min = 0, max = 1000000000) {
  ensure(
    (typeof value === "number" || typeof value === "string") &&
      value !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= min &&
      Number(value) <= max,
    `Revisa ${label}.`,
  );
  return Number(value);
}
export function date(value, label) {
  ensure(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      /(Z|[+-]\d{2}:\d{2})$/.test(value) &&
      Number.isFinite(Date.parse(value)),
    `Revisa la fecha de ${label}.`,
  );
  return new Date(value);
}
export function windowOpen(event, stage, start, end) {
  ensure(
    event.estado === stage &&
      Date.now() >= event[start] &&
      Date.now() <= event[end],
    "Esta operación no está habilitada en la etapa y fecha actuales.",
    409,
  );
}
export async function eventFor(user, kind, value, manage = false) {
  const event = await (kind === "torneos" ? Tournament : Hackathon).findById(
    id(value),
  );
  ensure(event, "Evento no encontrado.", 404);
  if (manage)
    ensure(managesEvent(user, event), "No gestionas este evento.", 403);
  else readableEvent(user, event);
  return event;
}
export function audit(req, kind, event, before, reason = "") {
  req.audit = {
    tipoEvento: kind,
    evento: String(event?._id || event),
    anterior: before ? plain(before) : null,
    motivo: reason,
  };
}
export function reason(body) {
  return text(body.motivo, "motivo", 1000, 5);
}
export function list(items) {
  return {
    items,
    total: items.length,
    page: 1,
    pages: 1,
    summary: { total: items.length, active: items.length },
  };
}
