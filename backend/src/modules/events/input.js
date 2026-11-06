import mongoose from "mongoose";
import { User } from "../../models.js";
import { requireRoles } from "../shared/access.js";

import { Discipline, Registration } from "../../competition-models.js";
import { ApiError, formFields, text } from "../../validation.js";
import { HackRegistration } from "../workflow/models.js";
import {
  id,
  integer,
  choice,
  strings,
  timestamp,
  optionalText,
  reference,
  approval,
} from "../shared/access.js";
// Configuración de eventos, ventanas y reglamentos. No mezcla las reglas deportivas con las de proyectos.
async function eventOwner(body, user, previous) {
  const owner = await reference(
    User,
    body.responsable,
    "El responsable",
    !previous || String(previous.responsable) !== body.responsable,
  );
  requireRoles(owner, ["administrador", "organizador"]);
  if (user.rol === "organizador" && String(owner._id) !== String(user._id))
    throw new ApiError(
      403,
      "Solo puedes gestionar los eventos asignados a tu cuenta.",
      "FORBIDDEN",
    );
  return owner._id;
}

export function eventDates(body, hackathon = false) {
  const fields = [
    "inicio",
    "fin",
    "inscripcionInicio",
    "inscripcionFin",
    ...(hackathon
      ? ["entregaInicio", "entregaFin", "evaluacionInicio", "evaluacionFin"]
      : []),
  ];
  const result = Object.fromEntries(
    fields.map((field) => [field, timestamp(body[field], field)]),
  );
  if (
    result.inscripcionInicio > result.inscripcionFin ||
    result.inscripcionFin > result.inicio ||
    result.inicio > result.fin
  )
    throw new ApiError(
      400,
      "Las inscripciones deben cerrar antes del inicio y la fecha final no puede ser anterior al inicio.",
    );
  if (
    hackathon &&
    (result.inicio > result.entregaInicio ||
      result.entregaInicio > result.entregaFin ||
      result.entregaFin > result.evaluacionInicio ||
      result.evaluacionInicio > result.evaluacionFin ||
      result.evaluacionFin > result.fin)
  )
    throw new ApiError(
      400,
      "Ordena las ventanas de entrega y evaluación dentro de las fechas del hackatón.",
    );
  return result;
}

export function ruleInput(body, category, mode, format) {
  formFields(body, [
    "integrantesMin",
    "integrantesMax",
    "maxInscripciones",
    "metrica",
    "unidad",
    "precision",
    "orden",
    "fases",
    "avance",
    "desempates",
    "pruebas",
    "requisitos",
    "permiteMultiplesEquipos",
    "clasificacion",
  ]);
  const integrantesMin = integer(
    body.integrantesMin,
    "Integrantes mínimos",
    1,
    100,
  );
  const integrantesMax = integer(
    body.integrantesMax,
    "Integrantes máximos",
    integrantesMin,
    100,
  );
  if (mode === "individual" && (integrantesMin !== 1 || integrantesMax !== 1))
    throw new ApiError(
      400,
      "Una inscripción individual debe tener un solo participante.",
    );
  if (
    body.permiteMultiplesEquipos !== undefined &&
    typeof body.permiteMultiplesEquipos !== "boolean"
  )
    throw new ApiError(400, "Revisa la política de múltiples equipos.");
  const pruebas = strings(
    body.pruebas || [],
    "pruebas",
    format === "pruebas" ? 1 : 0,
  );
  const classification = body.clasificacion || {
    victoria: 3,
    empate: 1,
    derrota: 0,
    avanzan: 2,
    criterios: ["puntos", "diferencia", "aFavor"],
    agregacion: "mejor",
  };
  formFields(classification, [
    "victoria",
    "empate",
    "derrota",
    "avanzan",
    "criterios",
    "agregacion",
  ]);
  const clasificacion = {
    victoria: integer(classification.victoria, "Puntos por victoria", 0, 100),
    empate: integer(classification.empate, "Puntos por empate", 0, 100),
    derrota: integer(classification.derrota, "Puntos por derrota", 0, 100),
    avanzan: integer(
      classification.avanzan,
      "Clasificados por grupo o prueba",
      1,
      1000,
    ),
    criterios: strings(
      classification.criterios,
      "desempates de clasificación",
    ).map((k) =>
      choice(
        k,
        ["puntos", "diferencia", "aFavor", "victorias"],
        "un criterio de clasificación",
      ),
    ),
    agregacion: choice(
      classification.agregacion,
      ["mejor", "suma", "promedio"],
      "una agregación de marcas",
    ),
  };
  return {
    clasificacion,
    integrantesMin,
    integrantesMax,
    maxInscripciones: integer(
      body.maxInscripciones,
      "Inscripciones por competidor",
      1,
      30,
    ),
    metrica: choice(
      body.metrica,
      ["goles", "puntos", "sets", "tiempo", "distancia", "otra"],
      "una métrica",
    ),
    unidad: text(body.unidad, "unidad", 40),
    precision: integer(body.precision, "Decimales", 0, 6),
    orden: choice(body.orden, ["ascendente", "descendente"], "un orden"),
    fases: strings(body.fases, "fases"),
    avance: text(body.avance, "avance", 1000),
    desempates: strings(body.desempates, "desempates"),
    pruebas,
    edadMin: category.edadMin,
    edadMax: category.edadMax,
    genero: category.genero,
    requisitos: optionalText(body.requisitos, "requisitos"),
    permiteMultiplesEquipos: body.permiteMultiplesEquipos || false,
  };
}

export async function tournamentInput(body, user, previous) {
  formFields(body, [
    "nombre",
    "descripcion",
    "tipo",
    "disciplina",
    "categoria",
    "unidadInscripcion",
    "formato",
    "ciudad",
    "departamento",
    "inicio",
    "fin",
    "inscripcionInicio",
    "inscripcionFin",
    "cupos",
    "responsable",
    "reglamento",
    "requiereAprobacion",
  ]);
  const discipline = await reference(
    Discipline,
    body.disciplina,
    "La disciplina",
    !previous || String(previous.disciplina) !== body.disciplina,
  );
  const category = discipline.categorias.id(id(body.categoria, "categoría"));
  if (!category)
    throw new ApiError(400, "La categoría no pertenece a la disciplina.");
  const unidadInscripcion = choice(
    body.unidadInscripcion,
    discipline.modalidades,
    "una modalidad de la disciplina",
  );
  const formato = choice(
    body.formato,
    discipline.formatos,
    "un formato de la disciplina",
  );
  const reglamento = ruleInput(
    body.reglamento,
    category,
    unidadInscripcion,
    formato,
  );
  const result = {
    nombre: text(body.nombre, "nombre", 150, 2),
    descripcion: optionalText(body.descripcion, "descripción"),
    tipo: choice(
      body.tipo,
      ["intercolegiados", "universitario"],
      "un tipo de torneo",
    ),
    disciplina: discipline._id,
    categoria: String(category._id),
    categoriaNombre: category.nombre,
    unidadInscripcion,
    formato,
    ciudad: text(body.ciudad, "ciudad", 100, 2),
    departamento: text(body.departamento, "departamento", 100, 2),
    ...eventDates(body),
    cupos: integer(body.cupos, "Cupos", 1, 10000),
    responsable: await eventOwner(body, user, previous),
    reglamento,
    requiereAprobacion: approval(body.requiereAprobacion),
  };
  if (previous && previous.estado !== "borrador") {
    if (
      String(previous.disciplina) !== String(result.disciplina) ||
      previous.categoria !== result.categoria ||
      previous.unidadInscripcion !== unidadInscripcion ||
      previous.formato !== formato ||
      Object.keys(reglamento).some(
        (field) =>
          JSON.stringify(previous.reglamento[field]) !==
          JSON.stringify(reglamento[field]),
      )
    )
      throw new ApiError(
        409,
        "El reglamento y el formato quedan bloqueados al abrir inscripciones.",
        "LOCKED_RULES",
      );
    if (
      (await Registration.countDocuments({
        torneo: previous._id,
        estado: { $in: ["pendiente", "confirmada"] },
      })) > result.cupos
    )
      throw new ApiError(
        409,
        "Los cupos no pueden ser menores que las inscripciones activas.",
      );
  }
  return result;
}

export async function hackathonInput(body, user, previous) {
  formFields(body, [
    "nombre",
    "descripcion",
    "ciudad",
    "departamento",
    "modalidad",
    "inicio",
    "fin",
    "inscripcionInicio",
    "inscripcionFin",
    "entregaInicio",
    "entregaFin",
    "evaluacionInicio",
    "evaluacionFin",
    "cupos",
    "integrantesMin",
    "integrantesMax",
    "proyectosPorEquipo",
    "categorias",
    "requisitos",
    "responsable",
    "requiereAprobacion",
    "requiereRepositorio",
    "requiereDemostracion",
  ]);
  const integrantesMin = integer(
    body.integrantesMin,
    "Integrantes mínimos",
    1,
    100,
  );
  const result = {
    nombre: text(body.nombre, "nombre", 150, 2),
    descripcion: text(body.descripcion, "descripción", 2000),
    ciudad: text(body.ciudad, "ciudad", 100, 2),
    departamento: text(body.departamento, "departamento", 100, 2),
    modalidad: choice(
      body.modalidad,
      ["presencial", "virtual", "hibrida"],
      "una modalidad",
    ),
    ...eventDates(body, true),
    cupos: integer(body.cupos, "Cupos de equipos", 1, 10000),
    integrantesMin,
    integrantesMax: integer(
      body.integrantesMax,
      "Integrantes máximos",
      integrantesMin,
      100,
    ),
    proyectosPorEquipo: integer(
      body.proyectosPorEquipo,
      "Proyectos por equipo",
      1,
      10,
    ),
    categorias: strings(body.categorias, "categorías"),
    requisitos: optionalText(body.requisitos, "requisitos"),
    responsable: await eventOwner(body, user, previous),
    requiereAprobacion: approval(body.requiereAprobacion),
    requiereRepositorio: approval(body.requiereRepositorio),
    requiereDemostracion: approval(body.requiereDemostracion),
  };
  if (
    previous &&
    (await HackRegistration.exists({
      hackaton: previous._id,
      estado: { $in: ["pendiente", "confirmada"] },
    }))
  ) {
    if (
      ["integrantesMin", "integrantesMax"].some(
        (k) => previous[k] !== result[k],
      ) ||
      previous.categorias.some((c) => !result.categorias.includes(c))
    )
      throw new ApiError(
        409,
        "No cambies los requisitos de plantillas ya inscritas.",
      );
    if (
      (await HackRegistration.countDocuments({
        hackaton: previous._id,
        estado: { $in: ["pendiente", "confirmada"] },
      })) > result.cupos
    )
      throw new ApiError(
        409,
        "Los cupos no pueden ser menores que las inscripciones activas.",
      );
  }
  return result;
}
