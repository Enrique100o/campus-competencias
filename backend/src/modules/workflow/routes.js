import { Router } from "express";
import { User } from "../../models.js";
import {
  Tournament,
  Hackathon,
  Participant,
  Team,
  Registration,
} from "../../competition-models.js";
import { competitionWrite, refreshActor } from "../shared/access.js";
import { requireCsrf } from "../../security.js";
import { listPagination, escapedSearch } from "../../validation.js";
import {
  Venue,
  HackRegistration,
  Competition,
  Result,
  Rubric,
  Project,
  Assignment,
  Evaluation,
  Audit,
} from "./models.js";
import {
  ensure,
  id,
  eventFor,
  managesEvent,
  requireRoles,
  plain,
  list,
  formFields,
} from "./common.js";
import { saveVenue } from "../venues/service.js";
import {
  registerHackathon,
  manageRegistration,
} from "../registrations/service.js";
import {
  scheduleCompetition,
  saveResult,
  standings,
  sportsAgenda,
} from "../sports/service.js";
import {
  saveProject,
  deliverProject,
  projectAccess,
} from "../hackathons/projects.js";
import {
  saveRubric,
  assignJury,
  saveEvaluation,
  hackathonReport,
} from "../hackathons/evaluations.js";
import { changeStage, changeDates } from "../events/service.js";
import { auditScope } from "../audit/middleware.js";

// Los controladores adaptan HTTP a servicios. La cola compartida protege cupos, agenda y evaluaciones.
function write(handler, status = 200) {
  return async (req, res) => {
    const value = await competitionWrite(async () => {
      await refreshActor(req);
      return handler(req);
    });
    res.status(status).json({ data: plain(value) });
  };
}
async function record(Model, value) {
  const result = await Model.findById(id(value));
  ensure(result, "Registro no encontrado.", 404);
  return result;
}
async function page(Model, query, params = {}, populate) {
  const { page, limit } = listPagination(params);
  let cursor = Model.find(query)
    .sort({ createdAt: -1, _id: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
  if (populate) cursor = cursor.populate(populate);
  const [items, total] = await Promise.all([
    cursor,
    Model.countDocuments(query),
  ]);
  return {
    items: plain(items),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: { total, active: total },
  };
}
async function projectScope(user) {
  if (user.rol === "administrador") return {};
  if (user.rol === "organizador")
    return {
      hackaton: {
        $in: await Hackathon.find({ responsable: user._id }).distinct("_id"),
      },
    };
  if (user.rol === "jurado")
    return {
      _id: {
        $in: await Assignment.find({ jurado: user._id, activo: true }).distinct(
          "proyecto",
        ),
      },
      estado: "entregado",
    };
  const people = await Participant.find({ usuario: user._id }).distinct("_id");
  const regs = await HackRegistration.find({
    "plantilla.participante": { $in: people },
    estado: "confirmada",
  }).distinct("_id");
  return {
    $or: [
      {
        equipo: {
          $in: await Team.find({ responsable: user._id }).distinct("_id"),
        },
      },
      { inscripcion: { $in: regs } },
    ],
  };
}

export function workflowRouter(authenticated) {
  const router = Router();
  router.use(authenticated);
  router.get("/escenarios", async (req, res) => {
    const query = {};
    if (req.query.estado) {
      ensure(
        ["activo", "inactivo"].includes(req.query.estado),
        "Estado inválido.",
      );
      query.estado = req.query.estado;
    }
    if (req.query.disciplina) query.disciplinas = id(req.query.disciplina);
    if (req.query.q)
      query.nombre = { $regex: escapedSearch(req.query.q), $options: "i" };
    res.json({ data: await page(Venue, query, req.query) });
  });
  router.get("/escenarios/:id", async (req, res) =>
    res.json({ data: plain(await record(Venue, req.params.id)) }),
  );
  router.post(
    "/escenarios",
    requireCsrf,
    write((req) => saveVenue(req.user, req.body), 201),
  );
  router.patch(
    "/escenarios/:id",
    requireCsrf,
    write(async (req) => {
      const previous = await record(Venue, req.params.id);
      req.audit = { anterior: plain(previous) };
      const keys = [
        "nombre",
        "tipo",
        "ubicacion",
        "capacidad",
        "disciplinas",
        "recursos",
        "disponibilidad",
        "estado",
      ];
      formFields(req.body, keys);
      const old = plain(previous);
      return saveVenue(
        req.user,
        { ...Object.fromEntries(keys.map((k) => [k, old[k]])), ...req.body },
        previous,
      );
    }),
  );
  router.get("/escenarios/:id/agenda", async (req, res) => {
    await record(Venue, req.params.id);
    const allowed =
      req.user.rol === "administrador"
        ? {}
        : {
            $or: [
              { estado: { $ne: "borrador" } },
              { responsable: req.user._id },
            ],
          };
    const events = await Tournament.find(allowed).distinct("_id");
    res.json({
      data: list(
        plain(
          await Competition.find({
            escenario: req.params.id,
            torneo: { $in: events },
          })
            .select("-personas")
            .sort({ inicio: 1 }),
        ),
      ),
    });
  });

  router.get("/inscripciones-hackaton", async (req, res) => {
    requireRoles(req.user, ["administrador", "organizador", "participante"]);
    let scope = {};
    if (req.user.rol === "organizador")
      scope.hackaton = {
        $in: await Hackathon.find({ responsable: req.user._id }).distinct(
          "_id",
        ),
      };
    if (req.user.rol === "participante") {
      const people = await Participant.find({ usuario: req.user._id }).distinct(
        "_id",
      );
      scope = {
        $or: [
          {
            equipo: {
              $in: await Team.find({ responsable: req.user._id }).distinct(
                "_id",
              ),
            },
          },
          { "plantilla.participante": { $in: people } },
        ],
      };
    }
    const filters = {};
    if (req.query.hackaton) filters.hackaton = id(req.query.hackaton);
    if (req.query.estado) filters.estado = req.query.estado;
    res.json({
      data: await page(
        HackRegistration,
        { $and: [scope, filters] },
        req.query,
        [
          { path: "equipo", select: "nombre responsable" },
          { path: "hackaton", select: "nombre" },
        ],
      ),
    });
  });
  router.post(
    "/inscripciones-hackaton",
    requireCsrf,
    write(registerHackathon, 201),
  );
  for (const [path, Model, kind] of [
    ["inscripciones", Registration, "torneos"],
    ["inscripciones-hackaton", HackRegistration, "hackatones"],
  ]) {
    router.patch(
      `/${path}/:id`,
      requireCsrf,
      write(async (req) =>
        manageRegistration(req, kind, await record(Model, req.params.id)),
      ),
    );
  }
  for (const kind of ["torneos", "hackatones"]) {
    router.patch(
      `/${kind}/:id/fechas`,
      requireCsrf,
      write((req) => changeDates(req, kind, req.params.id)),
    );
  }
  router.post(
    "/torneos/:id/cerrar",
    requireCsrf,
    write((req) => {
      req.body = { ...req.body, estado: "finalizado" };
      return changeStage(req, "torneos", req.params.id);
    }),
  );
  router.post(
    "/hackatones/:id/publicar",
    requireCsrf,
    write((req) => {
      req.body = { ...req.body, estado: "publicado" };
      return changeStage(req, "hackatones", req.params.id);
    }),
  );

  for (const path of ["competencias", "partidos", "pruebas"]) {
    router.post(
      `/${path}`,
      requireCsrf,
      write((req) => {
        if (path !== "competencias")
          req.body = {
            ...req.body,
            tipo: path === "partidos" ? "partido" : "prueba",
          };
        return scheduleCompetition(req);
      }, 201),
    );
  }
  router.patch(
    "/competencias/:id",
    requireCsrf,
    write(async (req) =>
      scheduleCompetition(req, await record(Competition, req.params.id)),
    ),
  );
  for (const path of ["agenda", "partidos"])
    router.get(`/torneos/:id/${path}`, async (req, res) => {
      const event = await eventFor(req.user, "torneos", req.params.id);
      const items = await sportsAgenda(req.user, event, req.query);
      res.json({
        data: list(
          plain(
            path === "partidos"
              ? items.filter((c) => c.tipo === "partido")
              : items,
          ),
        ),
      });
    });
  router.get("/torneos/:id/inscripciones", async (req, res) => {
    const event = await eventFor(req.user, "torneos", req.params.id, true);
    const registrations = await Registration.find({ torneo: event._id });
    const data = await Promise.all(
      registrations.map(async (r) => ({
        ...plain(r),
        competidorNombre:
          (
            await (r.modalidad === "individual" ? Participant : Team)
              .findById(r.competidor)
              .select("nombre")
          )?.nombre || "Competidor",
      })),
    );
    res.json({ data: list(data) });
  });
  router.get("/torneos/:id/inscritos", async (req, res) => {
    const event = await eventFor(req.user, "torneos", req.params.id);
    const { page: current, limit } = listPagination(req.query);
    const filter = {
      torneo: event._id,
      estado: { $in: ["confirmada", "pendiente"] },
    };
    const [registrations, confirmed, pending] = await Promise.all([
      Registration.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .skip((current - 1) * limit)
        .limit(limit)
        .select("modalidad competidor plantilla.nombre prueba estado")
        .lean(),
      Registration.countDocuments({ torneo: event._id, estado: "confirmada" }),
      Registration.countDocuments({ torneo: event._id, estado: "pendiente" }),
    ]);
    const teams = await Team.find({
      _id: {
        $in: registrations
          .filter((entry) => entry.modalidad !== "individual")
          .map((entry) => entry.competidor),
      },
    })
      .select("nombre")
      .lean();
    const names = new Map(teams.map((team) => [String(team._id), team.nombre]));
    const manager = managesEvent(req.user, event);
    const total = confirmed + pending;
    res.json({
      data: {
        items: registrations.map((entry) => ({
          id: String(entry._id),
          nombre:
            entry.modalidad === "individual"
              ? entry.plantilla?.[0]?.nombre || "Participante"
              : names.get(String(entry.competidor)) || "Equipo",
          estado: entry.estado,
          prueba: entry.prueba,
          integrantes:
            manager && entry.modalidad !== "individual"
              ? entry.plantilla.map((person) => person.nombre)
              : [],
        })),
        confirmed,
        pending,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });
  router.get("/torneos/:id/resultados", async (req, res) => {
    const event = await eventFor(req.user, "torneos", req.params.id);
    res.json({
      data: list(
        plain(
          await Result.find({ torneo: event._id }).populate(
            "competencia",
            "fase prueba grupo participaciones inicio",
          ),
        ),
      ),
    });
  });
  router.post(
    "/resultados",
    requireCsrf,
    write((req) => saveResult(req), 201),
  );
  router.patch(
    "/resultados/:id",
    requireCsrf,
    write(async (req) => saveResult(req, await record(Result, req.params.id))),
  );
  router.get("/clasificaciones/:torneoId", async (req, res) => {
    const event = await eventFor(req.user, "torneos", req.params.torneoId);
    res.json({ data: await standings(event, req.query) });
  });

  router.get("/proyectos", async (req, res) => {
    const filters = {};
    if (req.query.hackaton) filters.hackaton = id(req.query.hackaton);
    if (req.query.q)
      filters.nombre = { $regex: escapedSearch(req.query.q), $options: "i" };
    res.json({
      data: await page(
        Project,
        { $and: [await projectScope(req.user), filters] },
        req.query,
        [{ path: "equipo", select: "nombre" }],
      ),
    });
  });
  router.get("/proyectos/:id", async (req, res) => {
    const p = await record(Project, req.params.id);
    await projectAccess(req.user, p);
    res.json({ data: plain(p) });
  });
  router.post(
    "/proyectos",
    requireCsrf,
    write((req) => saveProject(req), 201),
  );
  router.patch(
    "/proyectos/:id",
    requireCsrf,
    write(async (req) =>
      saveProject(req, await record(Project, req.params.id)),
    ),
  );
  router.post(
    "/proyectos/:id/entregar",
    requireCsrf,
    write(async (req) =>
      deliverProject(req, await record(Project, req.params.id)),
    ),
  );
  router.get("/hackatones/:id/rubrica", async (req, res) => {
    const event = await eventFor(req.user, "hackatones", req.params.id);
    res.json({ data: plain(await Rubric.findOne({ hackaton: event._id })) });
  });
  router.put(
    "/hackatones/:id/rubrica",
    requireCsrf,
    write(async (req) =>
      saveRubric(
        req,
        await eventFor(req.user, "hackatones", req.params.id, true),
      ),
    ),
  );
  router.get("/asignaciones", async (req, res) => {
    requireRoles(req.user, ["administrador", "organizador", "jurado"]);
    let scope =
      req.user.rol === "jurado"
        ? { jurado: req.user._id }
        : req.user.rol === "organizador"
          ? {
              hackaton: {
                $in: await Hackathon.find({
                  responsable: req.user._id,
                }).distinct("_id"),
              },
            }
          : {};
    if (req.query.hackaton)
      scope = { $and: [scope, { hackaton: id(req.query.hackaton) }] };
    res.json({
      data: await page(Assignment, scope, req.query, [
        {
          path: "proyecto",
          select:
            "nombre estado descripcion repositorio demostracion categoria",
        },
        { path: "jurado", select: "nombre" },
      ]),
    });
  });
  router.post(
    "/asignaciones",
    requireCsrf,
    write((req) => assignJury(req), 201),
  );
  router.patch(
    "/asignaciones/:id",
    requireCsrf,
    write(async (req) =>
      assignJury(req, await record(Assignment, req.params.id)),
    ),
  );
  async function evaluationScope(req) {
    requireRoles(req.user, ["administrador", "organizador", "jurado"]);
    let scope =
      req.user.rol === "jurado"
        ? { jurado: req.user._id }
        : req.user.rol === "organizador"
          ? {
              hackaton: {
                $in: await Hackathon.find({
                  responsable: req.user._id,
                }).distinct("_id"),
              },
              estado: "enviada",
            }
          : {};
    if (req.query.hackaton)
      scope = { $and: [scope, { hackaton: id(req.query.hackaton) }] };
    return scope;
  }
  router.get("/evaluaciones", async (req, res) =>
    res.json({
      data: await page(Evaluation, await evaluationScope(req), req.query, [
        { path: "proyecto", select: "nombre" },
        { path: "jurado", select: "nombre" },
      ]),
    }),
  );
  router.get("/evaluaciones/:id", async (req, res) => {
    const scope = await evaluationScope(req);
    const e = await Evaluation.findOne({
      $and: [scope, { _id: id(req.params.id) }],
    });
    ensure(e, "Evaluación no encontrada.", 404);
    res.json({ data: plain(e) });
  });
  router.post(
    "/evaluaciones",
    requireCsrf,
    write((req) => saveEvaluation(req), 201),
  );
  router.patch(
    "/evaluaciones/:id",
    requireCsrf,
    write(async (req) =>
      saveEvaluation(req, await record(Evaluation, req.params.id)),
    ),
  );
  router.get("/hackatones/:id/reporte", async (req, res) => {
    const event = await eventFor(req.user, "hackatones", req.params.id);
    ensure(
      managesEvent(req.user, event) || event.estado === "publicado",
      "El reporte se consulta por participantes después de publicarse.",
      403,
    );
    const frozen =
      event.estado === "publicado"
        ? (await Hackathon.findById(event._id).select("+reportePublicado"))
            .reportePublicado
        : null;
    res.json({ data: frozen || (await hackathonReport(event)) });
  });
  router.get("/historial", async (req, res) => {
    requireRoles(req.user, ["administrador", "organizador"]);
    const scope = await auditScope(req.user),
      filters = {};
    if (req.query.evento) filters.evento = id(req.query.evento);
    if (req.query.operacion)
      filters.operacion = {
        $regex: escapedSearch(req.query.operacion),
        $options: "i",
      };
    if (req.query.desde || req.query.hasta) {
      filters.createdAt = {};
      for (const [field, operator] of [
        ["desde", "$gte"],
        ["hasta", "$lte"],
      ])
        if (req.query[field]) {
          const value = new Date(req.query[field]);
          ensure(Number.isFinite(+value), "Fecha del historial inválida.");
          filters.createdAt[operator] = value;
        }
    }
    res.json({
      data: await page(Audit, { $and: [scope, filters] }, req.query, [
        { path: "autor", select: "nombre rol" },
      ]),
    });
  });
  router.get("/flujo/catalogos", async (req, res) => {
    const manager = ["administrador", "organizador"].includes(req.user.rol);
    res.json({
      data: {
        escenarios: plain(await Venue.find({}).sort({ nombre: 1 })),
        jurados: manager
          ? plain(
              await User.find({ rol: "jurado", estado: "activo" }).select(
                "nombre rol estado",
              ),
            )
          : [],
      },
    });
  });
  return router;
}
