import { members } from "../shared/access.js";

import { User, Institution } from "../../models.js";
import {
  Discipline,
  Tournament,
  Hackathon,
  Participant,
  Registration,
} from "../../competition-models.js";
import { ApiError, formFields, normalize, text } from "../../validation.js";
import { HackRegistration } from "../workflow/models.js";
import {
  id,
  choice,
  activeState,
  reference,
  requireRoles,
  readableEvent,
  eligible,
} from "../shared/access.js";
// Equipos deportivos y tecnológicos, requisitos condicionales y bloqueo de plantillas confirmadas.
export async function teamInput(body, user, previous) {
  formFields(body, [
    "nombre",
    "tipo",
    "responsable",
    "estado",
    "institucion",
    "disciplina",
    "categoria",
    "modalidad",
    "hackaton",
    "categoriaTecnologica",
    "integrantes",
  ]);
  const tipo = choice(
    body.tipo,
    ["deportivo", "tecnologico"],
    "un tipo de equipo",
  );
  if (previous && tipo !== previous.tipo)
    throw new ApiError(
      409,
      "El tipo de un equipo existente no se puede cambiar.",
    );
  const owner = await reference(
    User,
    body.responsable,
    "El responsable",
    !previous || String(previous.responsable) !== body.responsable,
  );
  requireRoles(owner, ["administrador", "organizador", "participante"]);
  if (user.rol === "participante" && String(owner._id) !== String(user._id))
    throw new ApiError(
      403,
      "Solo puedes crear o gestionar tus equipos.",
      "FORBIDDEN",
    );
  if (!Array.isArray(body.integrantes || []))
    throw new ApiError(400, "Revisa los integrantes del equipo.");
  let roster = body.integrantes || [];
  if (!previous && user.rol === "participante") {
    const profile = await Participant.findOne({
      usuario: user._id,
      estado: "activo",
    });
    if (!profile)
      throw new ApiError(
        409,
        "Completa tu ficha de participante para crear un equipo.",
        "PROFILE_REQUIRED",
      );
    const ownId = String(profile._id);
    const ids = roster.map((value) => id(value, "integrante"));
    // Agrega al creador una sola vez, conservando la validación de duplicados.
    roster = ids.includes(ownId) ? ids : [ownId, ...ids];
  }
  const sameRoster =
    previous &&
    JSON.stringify(previous.integrantes.map(String).sort()) ===
      JSON.stringify((body.integrantes || []).map(String).sort());
  const sameReferences =
    previous &&
    [
      "institucion",
      "disciplina",
      "categoria",
      "modalidad",
      "hackaton",
      "categoriaTecnologica",
    ].every((key) => String(previous[key] || "") === String(body[key] || ""));
  const validateEligibility = !sameRoster || !sameReferences;
  const people = await members(roster, validateEligibility);
  const data = {
    nombre: text(body.nombre, "nombre", 120, 2),
    tipo,
    responsable: owner._id,
    estado: activeState(body.estado),
    integrantes: people.map((person) => person._id),
  };
  if (tipo === "deportivo") {
    const institution = await reference(
      Institution,
      body.institucion,
      "La institución",
      !previous || String(previous.institucion) !== body.institucion,
    );
    const discipline = await reference(
      Discipline,
      body.disciplina,
      "La disciplina",
      !previous || String(previous.disciplina) !== body.disciplina,
    );
    const category = discipline.categorias.id(id(body.categoria, "categoría"));
    if (!category)
      throw new ApiError(400, "La categoría no pertenece a la disciplina.");
    const modalidad = choice(
      body.modalidad,
      discipline.modalidades.filter((value) => value !== "individual"),
      "una modalidad de equipo",
    );
    if (validateEligibility)
      for (const person of people)
        await eligible(person, category, new Date(), institution._id);
    Object.assign(data, {
      institucion: institution._id,
      disciplina: discipline._id,
      categoria: String(category._id),
      categoriaNombre: category.nombre,
      modalidad,
    });
  } else {
    if (body.disciplina || body.institucion || body.categoria || body.modalidad)
      throw new ApiError(
        400,
        "Un equipo tecnológico utiliza los requisitos del hackatón.",
      );
    const hackathon = await reference(
      Hackathon,
      body.hackaton,
      "El hackatón de referencia",
      false,
    );
    readableEvent(user, hackathon);
    if (
      validateEligibility &&
      ["cancelado", "publicado"].includes(hackathon.estado)
    )
      throw new ApiError(
        400,
        "Este hackatón no admite nuevos equipos de referencia.",
      );
    const categoriaTecnologica = choice(
      body.categoriaTecnologica,
      hackathon.categorias,
      "una categoría del hackatón",
    );
    if (
      people.length < hackathon.integrantesMin ||
      people.length > hackathon.integrantesMax
    )
      throw new ApiError(
        400,
        "El equipo debe cumplir el tamaño de plantilla del hackatón.",
      );
    if (validateEligibility)
      for (const person of people) {
        await reference(User, person.usuario, "La cuenta del integrante");
        await reference(
          Institution,
          person.institucion,
          "La institución del integrante",
        );
      }
    Object.assign(data, { hackaton: hackathon._id, categoriaTecnologica });
  }
  data.clave = [
    normalize(data.nombre),
    tipo,
    data.institucion || "",
    data.disciplina || "",
    data.categoria || "",
    data.hackaton || "",
  ].join("|");
  const liveSports = previous
    ? await Tournament.find({
        estado: { $in: ["inscripciones", "en_curso"] },
      }).distinct("_id")
    : [];
  const liveHacks = previous
    ? await Hackathon.find({
        estado: { $in: ["inscripciones", "entrega", "evaluacion"] },
      }).distinct("_id")
    : [];
  if (
    previous &&
    ((await Registration.exists({
      competidor: previous._id,
      torneo: { $in: liveSports },
      estado: { $in: ["pendiente", "confirmada"] },
    })) ||
      (await HackRegistration.exists({
        equipo: previous._id,
        hackaton: { $in: liveHacks },
        estado: { $in: ["pendiente", "confirmada"] },
      })))
  ) {
    const rosterChanged =
      JSON.stringify(previous.integrantes.map(String).sort()) !==
      JSON.stringify(data.integrantes.map(String).sort());
    if (
      rosterChanged ||
      String(previous.institucion || "") !== String(data.institucion || "") ||
      String(previous.disciplina || "") !== String(data.disciplina || "") ||
      previous.categoria !== data.categoria ||
      previous.modalidad !== data.modalidad ||
      String(previous.hackaton || "") !== String(data.hackaton || "") ||
      previous.categoriaTecnologica !== data.categoriaTecnologica
    )
      throw new ApiError(
        409,
        "La plantilla y las referencias quedan confirmadas al inscribir el equipo.",
        "LOCKED_ROSTER",
      );
  }
  return data;
}
