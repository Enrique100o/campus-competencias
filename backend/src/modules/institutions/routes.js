import { Router } from "express";
import mongoose from "mongoose";
import { Institution, publicInstitution, states } from "../../models.js";
import { Participant, Team, Registration } from "../../competition-models.js";
import {
  ApiError,
  institutionInput,
  escapedSearch,
  formFields,
} from "../../validation.js";
import { requireAdmin, requireCsrf } from "../../security.js";
import {
  competitionWrite,
  refreshActor,
  requireRoles,
} from "../shared/access.js";
import { HackRegistration } from "../workflow/models.js";
// CRUD de instituciones: eliminación física únicamente cuando no hay relaciones.
const institutionFields = [
  "nombre",
  "ciudad",
  "departamento",
  "tipo",
  "estado",
];
function institutionId(value) {
  if (!mongoose.isObjectIdOrHexString(value))
    throw new ApiError(400, "Identificador de institución inválido.");
  return value;
}
async function institutionRecord(value) {
  const record = await Institution.findById(institutionId(value));
  if (!record)
    throw new ApiError(404, "Institución no encontrada.", "NOT_FOUND");
  return record;
}
function institutionWrite(req, operation) {
  // Comparte la cola con las nuevas asociaciones para evitar referencias a registros eliminados.
  return competitionWrite(async () => {
    await refreshActor(req);
    requireRoles(req.user, ["administrador"]);
    return operation();
  });
}

export function institutionRouter(authenticated) {
  const router = Router();
  router.get("/instituciones", authenticated, async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      throw new ApiError(400, "La paginación no es válida.");
    }
    const search = escapedSearch(req.query.q);
    const filter = {};
    if (search)
      filter.$or = ["nombre", "ciudad", "departamento"].map((field) => ({
        [field]: { $regex: search, $options: "i" },
      }));
    if (req.query.estado) {
      if (!states.includes(req.query.estado))
        throw new ApiError(400, "Estado inválido.");
      filter.estado = req.query.estado;
    }
    const [items, total, all, active, cities] = await Promise.all([
      Institution.find(filter)
        .sort({ nombre: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Institution.countDocuments(filter),
      Institution.countDocuments({}),
      Institution.countDocuments({ estado: "activo" }),
      Institution.distinct("ciudad"),
    ]);
    res.json({
      data: {
        items: items.map(publicInstitution),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        summary: { total: all, active, cities: cities.length },
      },
    });
  });

  router.post(
    "/instituciones",
    authenticated,
    requireAdmin,
    requireCsrf,
    async (req, res) => {
      formFields(req.body, institutionFields);
      const institution = await institutionWrite(req, () =>
        Institution.create(institutionInput(req.body)),
      );
      res.status(201).json({ data: publicInstitution(institution) });
    },
  );

  router.get("/instituciones/:id", authenticated, async (req, res) => {
    res.json({
      data: publicInstitution(await institutionRecord(req.params.id)),
    });
  });

  router.put(
    "/instituciones/:id",
    authenticated,
    requireAdmin,
    requireCsrf,
    async (req, res) => {
      formFields(req.body, institutionFields);
      if (
        institutionFields.some((field) => !Object.hasOwn(req.body, field)) ||
        !states.includes(req.body.estado)
      ) {
        throw new ApiError(
          400,
          "PUT requiere nombre, ciudad, departamento, tipo y estado válidos.",
        );
      }
      const institution = await institutionWrite(req, async () => {
        const input = institutionInput(req.body);
        const updated = await Institution.findByIdAndUpdate(
          institutionId(req.params.id),
          input,
          { returnDocument: "after", runValidators: true },
        );
        if (!updated)
          throw new ApiError(404, "Institución no encontrada.", "NOT_FOUND");
        return updated;
      });
      res.json({ data: publicInstitution(institution) });
    },
  );

  router.patch(
    "/instituciones/:id",
    authenticated,
    requireAdmin,
    requireCsrf,
    async (req, res) => {
      formFields(req.body, institutionFields);
      const institution = await institutionWrite(req, async () => {
        const record = await institutionRecord(req.params.id);
        Object.assign(
          record,
          institutionInput({ ...publicInstitution(record), ...req.body }),
        );
        return record.save();
      });
      res.json({ data: publicInstitution(institution) });
    },
  );

  router.delete(
    "/instituciones/:id",
    authenticated,
    requireAdmin,
    requireCsrf,
    async (req, res) => {
      const deleted = await institutionWrite(req, async () => {
        const institution = await institutionRecord(req.params.id);
        const references = await Promise.all([
          Participant.exists({ institucion: institution._id }),
          Team.exists({ institucion: institution._id }),
          Registration.exists({
            $or: [
              { institucion: institution._id },
              { "plantilla.institucion": institution._id },
            ],
          }),
          HackRegistration.exists({ "plantilla.institucion": institution._id }),
        ]);
        if (references.some(Boolean))
          throw new ApiError(
            409,
            "La institución tiene participantes, equipos o inscripciones. Desactívala para conservar su historial.",
            "INSTITUTION_IN_USE",
          );
        const deleted = await Institution.findByIdAndDelete(institution._id);
        if (!deleted)
          throw new ApiError(404, "Institución no encontrada.", "NOT_FOUND");
        return deleted;
      });
      res.json({
        data: { id: String(deleted._id), message: "Institución eliminada." },
      });
    },
  );

  return router;
}
