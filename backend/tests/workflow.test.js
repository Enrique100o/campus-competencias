import { before, beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { User, Session, Institution, initializeModels } from "../src/models.js";
import {
  competitionModels,
  Tournament,
  Hackathon,
  Registration,
  Team,
} from "../src/competition-models.js";
import {
  workflowModels,
  Competition,
  Result,
  HackRegistration,
  Project,
  Evaluation,
  Audit,
} from "../src/modules/workflow/models.js";
import { RefreshToken } from "../src/modules/auth/models.js";

const db = `codex_campus_workflow_${process.pid}_${randomBytes(6).toString("hex")}`;
const config = { ...readConfig(), allowInitialSetup: true, production: false };
const password = "SoloPruebas2026!";
const date = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
let app, admin, org, other, jury, people, accounts, institution, discipline;
const write = (actor, method, path, body) =>
  actor.agent[method]("/api/" + path)
    .set("X-CSRF-Token", actor.csrf)
    .send(body);
const create = async (path, body, actor = admin) =>
  (await write(actor, "post", path, body).expect(201)).body.data;
async function account(name, rol) {
  const user = await create("usuarios", {
    nombre: name,
    correo: name + "@example.test",
    password,
    rol,
    estado: "activo",
  });
  const agent = request.agent(app),
    response = await agent
      .post("/api/auth/login")
      .send({ correo: user.correo, password })
      .expect(200);
  return { agent, csrf: response.body.data.csrfToken, user };
}
const rules = (extra = {}) => ({
  integrantesMin: 1,
  integrantesMax: 4,
  maxInscripciones: 3,
  metrica: "puntos",
  unidad: "puntos",
  precision: 0,
  orden: "descendente",
  fases: ["Grupos", "Final"],
  avance: "Los dos mejores avanzan.",
  desempates: ["Puntos", "Diferencia de goles"],
  pruebas: [],
  requisitos: "Institución activa.",
  permiteMultiplesEquipos: false,
  ...extra,
});
async function sport(extra = {}) {
  const mode = extra.unidadInscripcion || "equipo";
  return create("torneos", {
    nombre: "Copa",
    descripcion: "Prueba",
    tipo: "intercolegiados",
    disciplina: discipline.id,
    categoria: discipline.categorias[0].id,
    unidadInscripcion: mode,
    formato: "liga",
    ciudad: "Popayán",
    departamento: "Cauca",
    inscripcionInicio: date(-10),
    inscripcionFin: date(1),
    inicio: date(2),
    fin: date(12),
    cupos: 8,
    responsable: org.user.id,
    reglamento: rules(),
    ...extra,
  });
}
async function hack(extra = {}) {
  return create("hackatones", {
    nombre: "Ideas Campus",
    descripcion: "Innovación para el campus",
    ciudad: "Popayán",
    departamento: "Cauca",
    modalidad: "presencial",
    inscripcionInicio: date(-10),
    inscripcionFin: date(1),
    inicio: date(2),
    entregaInicio: date(2),
    entregaFin: date(3),
    evaluacionInicio: date(4),
    evaluacionFin: date(5),
    fin: date(6),
    cupos: 8,
    integrantesMin: 1,
    integrantesMax: 3,
    proyectosPorEquipo: 1,
    categorias: ["Educación"],
    requisitos: "Trabajo original",
    responsable: org.user.id,
    ...extra,
  });
}
async function open(event, kind = "torneos") {
  return (
    await write(org, "patch", `${kind}/${event.id}/estado`, {
      estado: "inscripciones",
    }).expect(200)
  ).body.data;
}
async function sportsTeam(index = 0, name = "Equipo " + index) {
  return create("equipos", {
    nombre: name,
    tipo: "deportivo",
    responsable: accounts[index].user.id,
    estado: "activo",
    institucion: institution.id,
    disciplina: discipline.id,
    categoria: discipline.categorias[0].id,
    modalidad: "equipo",
    integrantes: [people[index].id],
  });
}
async function reg(event, team, index = 0) {
  return create(
    "inscripciones",
    { torneo: event.id, modalidad: "equipo", competidor: team.id },
    accounts[index],
  );
}
async function venue() {
  return create(
    "escenarios",
    {
      nombre: "Coliseo",
      tipo: "coliseo",
      ubicacion: "Campus central",
      capacidad: 30,
      disciplinas: [discipline.id],
      recursos: [
        { nombre: "Carril 1", capacidad: 3 },
        { nombre: "Carril 2", capacidad: 3 },
      ],
      disponibilidad: [],
      estado: "activo",
    },
    org,
  );
}
async function game(event, place, regs, extra = {}) {
  return create(
    "competencias",
    {
      torneo: event.id,
      tipo: "partido",
      fase: "Final",
      grupo: "A",
      prueba: "",
      escenario: place.id,
      inicio: date(3),
      fin: date(4),
      participaciones: regs.map((r) => ({ inscripcion: r.id })),
      recursos: [],
      obligatoria: true,
      ...extra,
    },
    org,
  );
}
async function sportsFixture() {
  const event = await open(await sport()),
    place = await venue(),
    teams = [await sportsTeam(0), await sportsTeam(1)],
    regs = [await reg(event, teams[0], 0), await reg(event, teams[1], 1)],
    competition = await game(event, place, regs);
  return { event, place, teams, regs, competition };
}
async function startSports(f) {
  await Tournament.updateOne(
    { _id: f.event.id },
    { $set: { inscripcionFin: date(-3), inicio: date(-2) } },
  );
  await Competition.updateOne(
    { _id: f.competition.id },
    { $set: { inicio: date(-1), fin: date(0.5) } },
  );
  await write(org, "patch", `torneos/${f.event.id}/estado`, {
    estado: "en_curso",
  }).expect(200);
}
async function hackFixture(extra = {}) {
  const event = await open(await hack(extra), "hackatones");
  const team = await create("equipos", {
    nombre: "Innovadores",
    tipo: "tecnologico",
    responsable: accounts[0].user.id,
    estado: "activo",
    hackaton: event.id,
    categoriaTecnologica: "Educación",
    integrantes: [people[0].id],
  });
  const registration = await create(
    "inscripciones-hackaton",
    { hackaton: event.id, equipo: team.id },
    accounts[0],
  );
  return { event, team, registration };
}
async function enterDelivery(f) {
  await Hackathon.updateOne(
    { _id: f.event.id },
    {
      $set: {
        inscripcionFin: date(-3),
        inicio: date(-2),
        entregaInicio: date(-2),
        entregaFin: date(1),
        evaluacionInicio: date(2),
      },
    },
  );
  await write(org, "patch", `hackatones/${f.event.id}/estado`, {
    estado: "entrega",
  }).expect(200);
}
async function project(f) {
  return create(
    "proyectos",
    {
      hackaton: f.event.id,
      equipo: f.team.id,
      nombre: "Solución Campus",
      categoria: "Educación",
      descripcion:
        "Una solución original para mejorar el aprendizaje en el campus.",
      repositorio: "https://github.com/example/proyecto",
      demostracion: "https://example.com/demo",
    },
    accounts[0],
  );
}
async function rubric(f) {
  return (
    await write(org, "put", `hackatones/${f.event.id}/rubrica`, {
      criterios: [
        { nombre: "Innovación", minimo: 0, maximo: 10, peso: 60 },
        { nombre: "Impacto", minimo: 0, maximo: 10, peso: 40 },
      ],
      agregacion: "promedio",
      juradosMinimos: 1,
      desempates: ["Innovación"],
      politicaEmpates: "pendiente",
    }).expect(200)
  ).body.data;
}
async function evaluationFixture() {
  const f = await hackFixture();
  await enterDelivery(f);
  f.project = await project(f);
  await write(
    accounts[0],
    "post",
    `proyectos/${f.project.id}/entregar`,
    {},
  ).expect(200);
  f.rubric = await rubric(f);
  f.assignment = await create(
    "asignaciones",
    { proyecto: f.project.id, jurado: jury.user.id },
    org,
  );
  await Hackathon.updateOne(
    { _id: f.event.id },
    {
      $set: {
        entregaFin: date(-1),
        evaluacionInicio: date(-1),
        evaluacionFin: date(2),
      },
    },
  );
  await write(org, "patch", `hackatones/${f.event.id}/estado`, {
    estado: "evaluacion",
  }).expect(200);
  return f;
}
function marks(f, a = 2, b = 1) {
  return {
    competencia: f.competition.id,
    marcas: [
      { inscripcion: f.regs[0].id, valor: a, estado: "valido" },
      { inscripcion: f.regs[1].id, valor: b, estado: "valido" },
    ],
  };
}
function scores(f, estado = "enviada", valor = 8) {
  return {
    proyecto: f.project.id,
    estado,
    criterios: f.rubric.criterios.map((c) => ({ criterio: c.id, valor })),
    observaciones: "Evaluación según rúbrica.",
  };
}

describe("Historias completas: permisos, escenarios, deportes y hackatones", () => {
  before(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || config.mongoUri, {
      dbName: db,
      serverSelectionTimeoutMS: 5000,
    });
    await initializeModels();
  });
  beforeEach(async () => {
    await Promise.all(
      [
        User,
        Session,
        Institution,
        RefreshToken,
        ...competitionModels,
        ...workflowModels,
      ].map((M) => M.deleteMany({})),
    );
    app = createApp(config);
    const agent = request.agent(app),
      response = await agent
        .post("/api/setup/administrador")
        .send({ nombre: "Admin", correo: "admin@example.test", password })
        .expect(201);
    admin = {
      agent,
      csrf: response.body.data.csrfToken,
      user: response.body.data.user,
    };
    org = await account("organizador", "organizador");
    other = await account("otro", "organizador");
    jury = await account("jurado", "jurado");
    institution = await create("instituciones", {
      nombre: "Colegio",
      ciudad: "Popayán",
      departamento: "Cauca",
      tipo: "colegio",
      estado: "activo",
    });
    discipline = await create("disciplinas", {
      nombre: "Multideporte",
      modalidades: ["equipo", "individual", "relevo"],
      formatos: ["liga", "grupos", "eliminacion", "pruebas", "rondas"],
      categorias: [
        {
          nombre: "Abierta",
          edadMin: null,
          edadMax: null,
          genero: "cualquiera",
        },
      ],
      estado: "activo",
    });
    accounts = [];
    people = [];
    for (let i = 0; i < 3; i++) {
      const actor = await account("persona" + i, "participante");
      accounts.push(actor);
      people.push(
        await create("participantes", {
          documento: "DOC" + i,
          nombre: "Persona " + i,
          nacimiento: "2005-06-01",
          genero: "otro",
          usuario: actor.user.id,
          institucion: institution.id,
          categoria: "Abierta",
          estado: "activo",
        }),
      );
    }
  });
  after(async () => {
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, db);
      assert.match(db, /^codex_campus_workflow_\d+_[a-f\d]{12}$/);
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it("HU007: administra escenarios compatibles, disponibilidad y permisos de propietario", async () => {
    const v = await venue();
    assert.equal(v.recursos.length, 2);
    await write(other, "patch", `escenarios/${v.id}`, {
      capacidad: 100,
    }).expect(403);
    await write(accounts[0], "post", "escenarios", {
      nombre: "No autorizado",
    }).expect(403);
    await write(org, "patch", `escenarios/${v.id}`, {
      estado: "inactivo",
    }).expect(200);
    const listed = await accounts[0].agent
      .get("/api/escenarios?estado=inactivo")
      .expect(200);
    assert.equal(listed.body.data.total, 1);
    await write(org, "post", "escenarios", {
      nombre: "Inválido",
      tipo: "piscina",
      ubicacion: "Campus",
      capacidad: 0,
      disciplinas: [discipline.id],
    }).expect(400);
  });
  it("HU011: exige transiciones válidas, fechas, motivos y autorización", async () => {
    const event = await sport();
    await write(other, "patch", `torneos/${event.id}/estado`, {
      estado: "inscripciones",
    }).expect(403);
    await write(org, "patch", `torneos/${event.id}/estado`, {
      estado: "finalizado",
    }).expect(409);
    await open(event);
    await write(org, "patch", `torneos/${event.id}/estado`, {
      estado: "en_curso",
    }).expect(409);
    await write(org, "patch", `torneos/${event.id}/estado`, {
      estado: "cancelado",
    }).expect(400);
    await write(org, "patch", `torneos/${event.id}/estado`, {
      estado: "cancelado",
      motivo: "Cambio autorizado de programación",
    }).expect(200);
    await write(org, "patch", `torneos/${event.id}/estado`, {
      estado: "inscripciones",
      motivo: "Reapertura autorizada del evento",
    }).expect(200);
    await write(org, "patch", `torneos/${event.id}/fechas`, {
      fin: date(15),
      motivo: "Ampliación autorizada de la jornada",
    }).expect(200);
  });
  it("HU017/HU014: inscribe hackatones con plantilla histórica y evita duplicados y cambios", async () => {
    const f = await hackFixture();
    assert.equal(f.registration.estado, "confirmada");
    assert.equal(f.registration.plantilla[0].nombre, people[0].nombre);
    await write(accounts[0], "post", "inscripciones-hackaton", {
      hackaton: f.event.id,
      equipo: f.team.id,
    }).expect(409);
    await write(accounts[0], "patch", `equipos/${f.team.id}`, {
      integrantes: [people[1].id],
    }).expect(409);
    const listed = await accounts[0].agent
      .get("/api/inscripciones-hackaton")
      .expect(200);
    assert.equal(listed.body.data.total, 1);
    await other.agent.get(`/proyectos/${f.team.id}`).expect(404);
  });
  it("HU017: protege el último cupo tecnológico ante concurrencia", async () => {
    const event = await open(await hack({ cupos: 1 }), "hackatones");
    const teams = [];
    for (let i = 0; i < 2; i++)
      teams.push(
        await create("equipos", {
          nombre: "Equipo " + i,
          tipo: "tecnologico",
          responsable: accounts[i].user.id,
          estado: "activo",
          hackaton: event.id,
          categoriaTecnologica: "Educación",
          integrantes: [people[i].id],
        }),
      );
    const results = await Promise.all(
      teams.map((t, i) =>
        write(accounts[i], "post", "inscripciones-hackaton", {
          hackaton: event.id,
          equipo: t.id,
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      await HackRegistration.countDocuments({ estado: "confirmada" }),
      1,
    );
  });
  it("HU018: resuelve pendientes, libera cupos al retirar y conserva historial", async () => {
    const f = await hackFixture({ requiereAprobacion: true, cupos: 1 });
    assert.equal(f.registration.estado, "pendiente");
    await write(
      accounts[0],
      "patch",
      `inscripciones-hackaton/${f.registration.id}`,
      { estado: "confirmada" },
    ).expect(403);
    await write(org, "patch", `inscripciones-hackaton/${f.registration.id}`, {
      estado: "confirmada",
    }).expect(200);
    await write(
      accounts[0],
      "patch",
      `inscripciones-hackaton/${f.registration.id}`,
      { estado: "cancelada", motivo: "El equipo no puede participar" },
    ).expect(200);
    const again = await create(
      "inscripciones-hackaton",
      { hackaton: f.event.id, equipo: f.team.id },
      accounts[0],
    );
    assert.equal(again.id, f.registration.id);
    assert.equal(again.estado, "pendiente");
    assert.ok(
      await Audit.exists({
        evento: f.event.id,
        motivo: "El equipo no puede participar",
      }),
    );
  });
  it("HU018: las inscripciones deportivas pendientes no se programan y se pueden retirar", async () => {
    const event = await open(await sport({ requiereAprobacion: true })),
      team = await sportsTeam(),
      r = await reg(event, team);
    assert.equal(r.estado, "pendiente");
    await write(org, "patch", `inscripciones/${r.id}`, {
      estado: "rechazada",
      motivo: "Falta completar documentación",
    }).expect(200);
    const again = await reg(event, team);
    assert.equal(again.id, r.id);
    await write(org, "patch", `inscripciones/${r.id}`, {
      estado: "confirmada",
    }).expect(200);
    await write(accounts[0], "patch", `inscripciones/${r.id}`, {
      estado: "cancelada",
      motivo: "Retiro voluntario del competidor",
    }).expect(200);
    assert.equal(
      await Registration.countDocuments({ estado: "confirmada" }),
      0,
    );
  });
  it("HU019/HU020: programa y consulta agenda sin datos personales", async () => {
    const f = await sportsFixture();
    const result = await accounts[0].agent
      .get(`/api/torneos/${f.event.id}/agenda`)
      .expect(200);
    assert.equal(result.body.data.items[0].participaciones.length, 2);
    assert.equal(result.body.data.items[0].personas, undefined);
    assert.equal(JSON.stringify(result.body).includes("DOC0"), false);
    await org.agent.get(`/api/torneos/${f.event.id}/partidos`).expect(200);
    await write(other, "patch", `competencias/${f.competition.id}`, {
      inicio: date(4),
      fin: date(5),
      motivo: "Cambio de horario autorizado",
    }).expect(403);
    await write(org, "patch", `competencias/${f.competition.id}`, {
      inicio: date(4),
      fin: date(5),
      motivo: "Cambio de horario autorizado",
    }).expect(200);
  });
  it("HU019: impide cruces del escenario y de personas incluso en escenarios distintos", async () => {
    const f = await sportsFixture();
    await write(org, "post", "competencias", {
      torneo: f.event.id,
      tipo: "partido",
      fase: "Final",
      escenario: f.place.id,
      inicio: date(3.5),
      fin: date(4.5),
      participaciones: f.regs.map((r) => ({ inscripcion: r.id })),
    }).expect(409);
    const second = await venue();
    await write(org, "post", "competencias", {
      torneo: f.event.id,
      tipo: "partido",
      fase: "Final",
      escenario: second.id,
      inicio: date(3.5),
      fin: date(4.5),
      participaciones: f.regs.map((r) => ({ inscripcion: r.id })),
    }).expect(409);
    await write(org, "patch", `escenarios/${f.place.id}`, {
      capacidad: 1,
    }).expect(409);
  });
  it("HU019: serializa reservas simultáneas del mismo horario", async () => {
    const event = await open(await sport()),
      place = await venue(),
      regs = [
        await reg(event, await sportsTeam(0)),
        await reg(event, await sportsTeam(1), 1),
      ];
    const body = {
      torneo: event.id,
      tipo: "partido",
      fase: "Final",
      escenario: place.id,
      inicio: date(3),
      fin: date(4),
      participaciones: regs.map((r) => ({ inscripcion: r.id })),
    };
    const responses = await Promise.all([
      write(org, "post", "competencias", body),
      write(org, "post", "competencias", body),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  });
  it("HU021/HU022/HU023: calcula resultados, clasificación y correcciones sin sumar dos veces", async () => {
    const f = await sportsFixture();
    await startSports(f);
    const result = await create("resultados", marks(f), org);
    assert.equal(result.ganadores[0], f.regs[0].id);
    await write(org, "post", "resultados", marks(f)).expect(409);
    let table = (
      await accounts[0].agent
        .get(`/api/clasificaciones/${f.event.id}`)
        .expect(200)
    ).body.data;
    assert.equal(table.grupos[0].tabla[0].puntos, 3);
    await write(org, "patch", `resultados/${result.id}`, {
      ...marks(f, 0, 3),
      motivo: "El acta original tenía el marcador invertido",
    }).expect(200);
    table = (
      await accounts[0].agent
        .get(`/api/clasificaciones/${f.event.id}`)
        .expect(200)
    ).body.data;
    assert.equal(table.grupos[0].tabla[0].inscripcion, f.regs[1].id);
    assert.equal(table.grupos[0].tabla[0].puntos, 3);
    assert.equal(
      await Result.countDocuments({ competencia: f.competition.id }),
      1,
    );
    const history = await Audit.findOne({
      identificador: result.id,
      operacion: { $regex: "PATCH" },
    });
    assert.ok(history.anterior.marcas);
    assert.ok(history.motivo);
  });
  it("HU021: rechaza resultados manipulados y no convierte ausencias en cero ganador", async () => {
    const f = await sportsFixture();
    await startSports(f);
    await write(accounts[0], "post", "resultados", marks(f)).expect(403);
    await write(org, "post", "resultados", { ...marks(f), total: 100 }).expect(
      400,
    );
    await write(org, "post", "resultados", marks(f, 2.5, 1)).expect(400);
    const body = marks(f);
    body.marcas[0] = {
      inscripcion: f.regs[0].id,
      estado: "no_presentacion",
      valor: null,
    };
    const r = await create("resultados", body, org);
    assert.deepEqual(r.ganadores, [f.regs[1].id]);
  });
  it("HU024: cierra el torneo solo con resultados resueltos y exige motivo para reabrir", async () => {
    const f = await sportsFixture();
    await startSports(f);
    await write(org, "post", `torneos/${f.event.id}/cerrar`, {}).expect(409);
    const result = await create("resultados", marks(f), org);
    await write(org, "post", `torneos/${f.event.id}/cerrar`, {}).expect(200);
    await write(org, "patch", `resultados/${result.id}`, {
      ...marks(f, 4, 1),
      motivo: "Corrección fuera de etapa",
    }).expect(409);
    await write(org, "patch", `torneos/${f.event.id}/estado`, {
      estado: "en_curso",
    }).expect(400);
    await write(org, "patch", `torneos/${f.event.id}/estado`, {
      estado: "en_curso",
      motivo: "Reapertura autorizada por acta",
    }).expect(200);
  });
  it("HU025/HU026: solo inscritos crean proyectos y la entrega conserva una versión", async () => {
    const f = await hackFixture({ requiereRepositorio: true });
    await enterDelivery(f);
    const p = await project(f);
    await write(accounts[1], "patch", `proyectos/${p.id}`, {
      nombre: "Ajeno",
    }).expect(403);
    await write(accounts[0], "post", "proyectos", {
      hackaton: f.event.id,
      equipo: f.team.id,
      nombre: "Segundo",
      categoria: "Educación",
    }).expect(409);
    const delivered = (
      await write(accounts[0], "post", `proyectos/${p.id}/entregar`, {}).expect(
        200,
      )
    ).body.data;
    assert.equal(delivered.presentacion.version, p.version);
    const edited = (
      await write(accounts[0], "patch", `proyectos/${p.id}`, {
        descripcion: "Descripción corregida y documentada del proyecto.",
      }).expect(200)
    ).body.data;
    assert.equal(edited.estado, "borrador");
    assert.equal(edited.version, 2);
    assert.equal(edited.presentacion.version, 1);
    await write(accounts[0], "post", `proyectos/${p.id}/entregar`, {}).expect(
      200,
    );
  });
  it("HU025/HU026: valida enlaces y bloquea edición después de la ventana", async () => {
    const f = await hackFixture();
    await enterDelivery(f);
    await write(accounts[0], "post", "proyectos", {
      hackaton: f.event.id,
      equipo: f.team.id,
      nombre: "Proyecto",
      categoria: "Educación",
      repositorio: "javascript:alert(1)",
    }).expect(400);
    const p = await project(f);
    await Hackathon.updateOne(
      { _id: f.event.id },
      { $set: { entregaFin: date(-1) } },
    );
    await write(accounts[0], "post", `proyectos/${p.id}/entregar`, {}).expect(
      409,
    );
  });
  it("HU027/HU028: valida pesos y jurados, protege asignaciones y proyectos ajenos", async () => {
    const f = await hackFixture();
    await enterDelivery(f);
    f.project = await project(f);
    await write(
      accounts[0],
      "post",
      `proyectos/${f.project.id}/entregar`,
      {},
    ).expect(200);
    await write(org, "put", `hackatones/${f.event.id}/rubrica`, {
      criterios: [{ nombre: "Impacto", minimo: 0, maximo: 10, peso: 60 }],
    }).expect(400);
    await rubric(f);
    await write(other, "post", "asignaciones", {
      proyecto: f.project.id,
      jurado: jury.user.id,
    }).expect(403);
    await write(org, "post", "asignaciones", {
      proyecto: f.project.id,
      jurado: accounts[1].user.id,
    }).expect(400);
    await create(
      "asignaciones",
      { proyecto: f.project.id, jurado: jury.user.id },
      org,
    );
    await write(org, "post", "asignaciones", {
      proyecto: f.project.id,
      jurado: jury.user.id,
    }).expect(409);
    await jury.agent.get(`/api/proyectos/${f.project.id}`).expect(200);
    await accounts[1].agent.get(`/api/proyectos/${f.project.id}`).expect(403);
  });
  it("HU029/HU030/HU031: calcula notas, corrige sin duplicar y publica solo evaluaciones completas", async () => {
    const f = await evaluationFixture();
    await write(org, "post", `hackatones/${f.event.id}/publicar`, {}).expect(
      409,
    );
    const draft = await create("evaluaciones", scores(f, "borrador"), jury);
    assert.equal(draft.total, 80);
    let report = (
      await org.agent.get(`/api/hackatones/${f.event.id}/reporte`).expect(200)
    ).body.data;
    assert.equal(report.proyectos[0].puntaje, null);
    assert.equal(report.proyectos[0].pendientes, 1);
    await write(
      jury,
      "patch",
      `evaluaciones/${draft.id}`,
      scores(f, "enviada"),
    ).expect(200);
    await write(jury, "patch", `evaluaciones/${draft.id}`, {
      ...scores(f, "enviada", 9),
      motivo: "Ajuste tras revisar la evidencia presentada",
    }).expect(200);
    assert.equal(
      await Evaluation.countDocuments({ proyecto: f.project.id }),
      1,
    );
    report = (
      await org.agent.get(`/api/hackatones/${f.event.id}/reporte`).expect(200)
    ).body.data;
    assert.equal(report.proyectos[0].puntaje, 90);
    assert.equal(report.publicable, true);
    await accounts[0].agent
      .get(`/api/hackatones/${f.event.id}/reporte`)
      .expect(403);
    await write(org, "post", `hackatones/${f.event.id}/publicar`, {}).expect(
      200,
    );
    await accounts[0].agent
      .get(`/api/hackatones/${f.event.id}/reporte`)
      .expect(200);
    await write(jury, "patch", `evaluaciones/${draft.id}`, {
      ...scores(f),
      motivo: "Intento después de publicar",
    }).expect(409);
  });
  it("HU029: rechaza criterios extra, total enviado, jurado ajeno y notas fuera de rango", async () => {
    const f = await evaluationFixture();
    await write(accounts[0], "post", "evaluaciones", scores(f)).expect(403);
    await write(jury, "post", "evaluaciones", {
      ...scores(f),
      total: 100,
    }).expect(400);
    await write(jury, "post", "evaluaciones", scores(f, "enviada", 11)).expect(
      400,
    );
    const missing = scores(f);
    missing.criterios.pop();
    await write(jury, "post", "evaluaciones", missing).expect(400);
    const responses = await Promise.all([
      write(jury, "post", "evaluaciones", scores(f)),
      write(jury, "post", "evaluaciones", scores(f)),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    const another = await account("juradoajeno", "jurado");
    const id = (await Evaluation.findOne()).id;
    await another.agent.get("/api/evaluaciones/" + id).expect(404);
    await write(another, "patch", "evaluaciones/" + id, {
      ...scores(f),
      motivo: "Intento no autorizado",
    }).expect(403);
  });
  it("HU027/HU028/HU030: bloquea rúbrica y retiro de asignación evaluada y conserva correcciones", async () => {
    const f = await evaluationFixture(),
      e = await create("evaluaciones", scores(f), jury);
    await write(org, "put", `hackatones/${f.event.id}/rubrica`, {
      criterios: [{ nombre: "Cambio", minimo: 0, maximo: 10, peso: 100 }],
    }).expect(409);
    await write(org, "patch", `asignaciones/${f.assignment.id}`, {
      activo: false,
      motivo: "Intento de retirar nota enviada",
    }).expect(409);
    await write(
      jury,
      "patch",
      `evaluaciones/${e.id}`,
      scores(f, "enviada", 9),
    ).expect(400);
    await write(jury, "patch", `evaluaciones/${e.id}`, {
      ...scores(f, "enviada", 9),
      motivo: "Corrección justificada del jurado",
    }).expect(200);
    assert.ok(
      await Audit.exists({
        identificador: e.id,
        motivo: "Corrección justificada del jurado",
      }),
    );
  });
  it("HU019/HU021/HU022: soporta pruebas individuales, carriles y clasificación por menor tiempo", async () => {
    const event = await open(
      await sport({
        unidadInscripcion: "individual",
        formato: "pruebas",
        reglamento: rules({
          integrantesMin: 1,
          integrantesMax: 1,
          metrica: "tiempo",
          unidad: "segundos",
          precision: 2,
          orden: "ascendente",
          fases: ["Final"],
          pruebas: ["100 metros"],
        }),
      }),
    );
    const regs = [];
    for (let i = 0; i < 2; i++)
      regs.push(
        await create(
          "inscripciones",
          {
            torneo: event.id,
            modalidad: "individual",
            competidor: people[i].id,
            prueba: "100 metros",
          },
          accounts[i],
        ),
      );
    const place = await venue();
    const competition = await game(event, place, regs, {
      tipo: "prueba",
      prueba: "100 metros",
      recursos: ["Carril 1", "Carril 2"],
      participaciones: regs.map((r, i) => ({
        inscripcion: r.id,
        carril: "Carril " + (i + 1),
        serie: "1",
        posicion: String(i + 1),
      })),
    });
    const f = { event, competition, regs };
    await startSports(f);
    const result = await create("resultados", marks(f, 11.32, 10.28), org);
    assert.deepEqual(result.ganadores, [regs[1].id]);
    const table = (
      await accounts[0].agent
        .get(`/api/clasificaciones/${event.id}?prueba=100%20metros`)
        .expect(200)
    ).body.data;
    assert.equal(table.grupos[0].tabla[0].marca, 10.28);
    assert.equal(table.grupos[0].tabla[0].clasificado, true);
    assert.equal(table.grupos[0].tabla[1].clasificado, false);
  });
  it("HU022/HU024: un empate no resuelto bloquea un ganador definitivo", async () => {
    const f = await sportsFixture();
    await startSports(f);
    await create("resultados", marks(f, 2, 2), org);
    const table = (
      await org.agent.get(`/api/clasificaciones/${f.event.id}`).expect(200)
    ).body.data;
    assert.ok(table.grupos[0].tabla.every((r) => r.empate && !r.clasificado));
    await write(org, "post", `torneos/${f.event.id}/cerrar`, {}).expect(409);
  });
  it("HU023: no permite reinterpretar una ronda con competiciones posteriores activas", async () => {
    const f = await sportsFixture();
    await Competition.updateOne(
      { _id: f.competition.id },
      { $set: { fase: "Grupos" } },
    );
    await startSports(f);
    const r = await create("resultados", marks(f), org);
    await Competition.create({
      torneo: f.event.id,
      escenario: f.place.id,
      tipo: "partido",
      fase: "Final",
      inicio: new Date(date(2)),
      fin: new Date(date(3)),
      participaciones: [],
      personas: [],
      recursos: [],
      creadoPor: org.user.id,
    });
    await write(org, "patch", `resultados/${r.id}`, {
      ...marks(f, 3, 1),
      motivo: "Se encontró un error en el acta",
    }).expect(409);
  });
  it("HU014: permite otra plantilla tras cerrar el evento y conserva la inscrita", async () => {
    const f = await sportsFixture();
    await startSports(f);
    await create("resultados", marks(f), org);
    await write(org, "post", `torneos/${f.event.id}/cerrar`, {}).expect(200);
    await write(accounts[0], "patch", `equipos/${f.teams[0].id}`, {
      integrantes: [people[2].id],
    }).expect(200);
    const registration = await Registration.findById(f.regs[0].id);
    assert.equal(String(registration.plantilla[0].participante), people[0].id);
  });
  it("HU031: congela el reporte publicado aunque cambie el nombre del equipo", async () => {
    const f = await evaluationFixture();
    await create("evaluaciones", scores(f), jury);
    await write(org, "post", `hackatones/${f.event.id}/publicar`, {}).expect(
      200,
    );
    await Team.updateOne(
      { _id: f.team.id },
      { $set: { nombre: "Nombre posterior de prueba" } },
    );
    const report = (
      await accounts[0].agent
        .get(`/api/hackatones/${f.event.id}/reporte`)
        .expect(200)
    ).body.data;
    assert.equal(report.proyectos[0].equipo, "Innovadores");
    assert.equal(report.proyectos[0].puntaje, 80);
  });
  it("HU032: restringe historial por evento y no expone contraseñas ni tokens", async () => {
    const event = await sport();
    await open(event);
    const own = await org.agent
      .get(`/api/historial?evento=${event.id}`)
      .expect(200);
    assert.ok(own.body.data.total > 0);
    const foreign = await other.agent
      .get(`/api/historial?evento=${event.id}`)
      .expect(200);
    assert.equal(foreign.body.data.total, 0);
    await accounts[0].agent.get("/api/historial").expect(403);
    const serialized = JSON.stringify(
      (await admin.agent.get("/api/historial?limit=50").expect(200)).body,
    );
    assert.equal(
      /password|csrfToken|accessToken|tokenHash/.test(serialized),
      false,
    );
    await write(admin, "patch", "historial/" + event.id, {
      motivo: "No editable",
    }).expect(404);
  });
});
