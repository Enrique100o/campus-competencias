import mongoose from "mongoose";

import {
  Tournament,
  Team,
  participationModes,
  competitionFormats,
} from "../../competition-models.js";
import { ApiError, formFields, normalize, text } from "../../validation.js";

import { id, integer, choice, strings, activeState } from "../shared/access.js";
// Categorías, modalidades y formatos; protege las categorías utilizadas por eventos existentes.
export async function disciplineInput(body, previous) {
  formFields(body, [
    "nombre",
    "modalidades",
    "formatos",
    "categorias",
    "estado",
  ]);
  const nombre = text(body.nombre, "nombre", 100, 2);
  const modalidades = strings(body.modalidades, "modalidades", 1, 3).map(
    (value) => choice(value, participationModes, "una modalidad"),
  );
  const formatos = strings(body.formatos, "formatos", 1, 5).map((value) =>
    choice(value, competitionFormats, "un formato"),
  );
  if (
    !Array.isArray(body.categorias) ||
    !body.categorias.length ||
    body.categorias.length > 30
  )
    throw new ApiError(400, "Agrega entre 1 y 30 categorías.");
  const categorias = body.categorias.map((category) => {
    formFields(category, ["id", "nombre", "edadMin", "edadMax", "genero"]);
    const edadMin =
      category.edadMin === null ||
      category.edadMin === "" ||
      category.edadMin === undefined
        ? null
        : integer(category.edadMin, "Edad mínima", 0, 100);
    const edadMax =
      category.edadMax === null ||
      category.edadMax === "" ||
      category.edadMax === undefined
        ? null
        : integer(category.edadMax, "Edad máxima", 0, 100);
    if (edadMin !== null && edadMax !== null && edadMin > edadMax)
      throw new ApiError(400, "La edad mínima no puede superar la máxima.");
    const result = {
      nombre: text(category.nombre, "categoría", 80, 2),
      edadMin,
      edadMax,
      genero: choice(
        category.genero || "cualquiera",
        ["cualquiera", "femenino", "masculino"],
        "un género de categoría",
      ),
    };
    if (category.id) {
      const categoryId = id(category.id, "categoría");
      if (!previous?.categorias.some((item) => String(item._id) === categoryId))
        throw new ApiError(400, "La categoría no pertenece a esta disciplina.");
      result._id = categoryId;
    }
    return result;
  });
  if (
    new Set(categorias.map((category) => normalize(category.nombre))).size !==
    categorias.length
  )
    throw new ApiError(400, "No repitas categorías dentro de la disciplina.");
  if (previous) {
    const [tournaments, teams] = await Promise.all([
      Tournament.find({ disciplina: previous._id }),
      Team.find({ disciplina: previous._id }),
    ]);
    for (const record of [...tournaments, ...teams]) {
      const old = previous.categorias.id(record.categoria);
      const next = categorias.find(
        (item) => String(item._id) === record.categoria,
      );
      if (
        !next ||
        !old ||
        ["nombre", "edadMin", "edadMax", "genero"].some(
          (field) => next[field] !== old[field],
        )
      )
        throw new ApiError(
          409,
          "No puedes cambiar o retirar una categoría que ya está en uso. Agrega otra categoría.",
        );
      if (
        (record.unidadInscripcion &&
          !modalidades.includes(record.unidadInscripcion)) ||
        (record.modalidad && !modalidades.includes(record.modalidad)) ||
        (record.formato && !formatos.includes(record.formato))
      )
        throw new ApiError(
          409,
          "No puedes retirar una modalidad o formato en uso.",
        );
    }
  }
  return {
    nombre,
    clave: normalize(nombre),
    modalidades,
    formatos,
    categorias,
    estado: activeState(body.estado),
  };
}
