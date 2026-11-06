import { members } from "../shared/access.js";
import mongoose from "mongoose";
import { Institution } from "../../models.js";
import {
  Discipline,
  Tournament,
  Participant,
  Team,
  Registration,
} from "../../competition-models.js";
import { ApiError, formFields } from "../../validation.js";

import {
  choice,
  reference,
  requireRoles,
  managesEvent,
  readableEvent,
  eligible,
} from "../shared/access.js";
// Inscripción deportiva: elegibilidad, cupos, límites, duplicados y fotografía de plantilla.
export async function registerCompetitor(body, user) {
  formFields(body, ["torneo", "modalidad", "competidor", "prueba"]);
  requireRoles(user, ["administrador", "organizador", "participante"]);
  const tournament = await reference(
    Tournament,
    body.torneo,
    "El torneo",
    false,
  );
  readableEvent(user, tournament);
  const now = new Date();
  if (
    tournament.estado !== "inscripciones" ||
    now < tournament.inscripcionInicio ||
    now > tournament.inscripcionFin
  )
    throw new ApiError(
      409,
      "El torneo no está dentro de su ventana de inscripción.",
      "REGISTRATION_CLOSED",
    );
  const modalidad = choice(
    body.modalidad,
    [tournament.unidadInscripcion],
    "la modalidad del torneo",
  );
  const prueba = body.prueba || "";
  if (
    tournament.reglamento.pruebas.length
      ? !tournament.reglamento.pruebas.includes(prueba)
      : prueba !== ""
  )
    throw new ApiError(400, "Selecciona una prueba válida del torneo.");
  await reference(Discipline, tournament.disciplina, "La disciplina");
  let institution;
  let people;
  let competitor;
  if (modalidad === "individual") {
    competitor = await reference(
      Participant,
      body.competidor,
      "El participante",
    );
    if (
      !managesEvent(user, tournament) &&
      String(competitor.usuario) !== String(user._id)
    )
      throw new ApiError(
        403,
        "No puedes inscribir a este participante en este torneo.",
        "FORBIDDEN",
      );
    institution = competitor.institucion;
    people = [competitor];
  } else {
    competitor = await reference(Team, body.competidor, "El equipo");
    if (
      !managesEvent(user, tournament) &&
      String(competitor.responsable) !== String(user._id)
    )
      throw new ApiError(
        403,
        "No representas a este equipo ni gestionas este torneo.",
        "FORBIDDEN",
      );
    if (
      competitor.tipo !== "deportivo" ||
      String(competitor.disciplina) !== String(tournament.disciplina) ||
      competitor.categoria !== tournament.categoria ||
      competitor.modalidad !== modalidad
    )
      throw new ApiError(
        400,
        "El equipo no corresponde a la disciplina, categoría o modalidad del torneo.",
        "ELIGIBILITY",
      );
    institution = competitor.institucion;
    people = await members(competitor.integrantes.map(String));
  }
  if (
    people.length < tournament.reglamento.integrantesMin ||
    people.length > tournament.reglamento.integrantesMax
  )
    throw new ApiError(
      400,
      "La plantilla no cumple el reglamento del torneo.",
      "ELIGIBILITY",
    );
  await reference(Institution, institution, "La institución");
  for (const person of people)
    await eligible(
      person,
      tournament.reglamento,
      tournament.inicio,
      institution,
    );
  const competitorId = competitor._id;
  const active = { estado: { $in: ["pendiente", "confirmada"] } };
  const previous = await Registration.findOne({
    torneo: tournament._id,
    modalidad,
    competidor: competitorId,
    prueba,
  });
  if (previous && ["pendiente", "confirmada"].includes(previous.estado))
    throw new ApiError(
      409,
      "El competidor ya está inscrito en esta prueba.",
      "DUPLICATE_REGISTRATION",
    );
  if (
    (await Registration.countDocuments({
      torneo: tournament._id,
      competidor: competitorId,
      ...active,
    })) >= tournament.reglamento.maxInscripciones
  )
    throw new ApiError(
      409,
      "El competidor alcanzó su límite de inscripciones.",
      "REGISTRATION_LIMIT",
    );
  if (
    !tournament.reglamento.permiteMultiplesEquipos &&
    (await Registration.exists({
      torneo: tournament._id,
      competidor: { $ne: competitorId },
      ...active,
      "plantilla.participante": { $in: people.map((person) => person._id) },
    }))
  )
    throw new ApiError(
      409,
      "Un integrante ya participa con otro equipo en este torneo.",
      "MULTIPLE_TEAMS",
    );
  if (
    (await Registration.countDocuments({
      torneo: tournament._id,
      ...active,
    })) >= tournament.cupos
  )
    throw new ApiError(409, "El torneo ya completó sus cupos.", "FULL");
  const data = {
    torneo: tournament._id,
    modalidad,
    competidor: competitorId,
    institucion: institution,
    prueba,
    creadoPor: user._id,
    estado: tournament.requiereAprobacion ? "pendiente" : "confirmada",
    motivo: "",
    reglamentoVersion: tournament.reglamentoVersion,
    plantilla: people.map((person) => ({
      participante: person._id,
      nombre: person.nombre,
      institucion: person.institucion,
    })),
  };
  if (previous) {
    Object.assign(previous, data);
    await previous.save();
    return previous;
  }
  return Registration.create(data);
}
