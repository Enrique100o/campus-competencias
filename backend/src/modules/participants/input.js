import mongoose from "mongoose";
import { User, Institution } from "../../models.js";

import { ApiError, formFields, text } from "../../validation.js";

import { choice, activeState, reference } from "../shared/access.js";
// Identidad y referencias del participante; la elegibilidad deportiva se comprueba al inscribir.
export async function participantInput(body, previous) {
  formFields(body, [
    "documento",
    "nombre",
    "nacimiento",
    "genero",
    "usuario",
    "institucion",
    "categoria",
    "estado",
  ]);
  if (
    typeof body.nacimiento !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.nacimiento)
  )
    throw new ApiError(400, "Revisa la fecha de nacimiento.");
  const nacimiento = new Date(`${body.nacimiento}T00:00:00.000Z`);
  if (
    !Number.isFinite(nacimiento.getTime()) ||
    nacimiento.toISOString().slice(0, 10) !== body.nacimiento ||
    nacimiento > new Date() ||
    nacimiento.getUTCFullYear() < 1900
  )
    throw new ApiError(400, "La fecha de nacimiento no es válida.");
  const user = await reference(
    User,
    body.usuario,
    "La cuenta del participante",
    !previous || String(previous.usuario) !== body.usuario,
  );
  if (user.rol !== "participante")
    throw new ApiError(400, "Asocia una cuenta con rol de participante.");
  const institution = await reference(
    Institution,
    body.institucion,
    "La institución",
    !previous || String(previous.institucion) !== body.institucion,
  );
  return {
    documento: text(body.documento, "documento", 30, 2)
      .replace(/\s+/g, "")
      .toUpperCase(),
    nombre: text(body.nombre, "nombre", 100, 2),
    nacimiento,
    genero: choice(body.genero, ["femenino", "masculino", "otro"], "un género"),
    usuario: user._id,
    institucion: institution._id,
    categoria: text(body.categoria, "categoría de referencia", 80, 2),
    estado: activeState(body.estado),
  };
}
