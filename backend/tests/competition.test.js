import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { User, Session, Institution, initializeModels } from '../src/models.js';
import { competitionModels, Participant, Registration } from '../src/competition-models.js';

const db = `codex_campus_test_${process.pid}_${randomBytes(6).toString('hex')}`;
const config = { ...readConfig(), allowInitialSetup: true, production: false };
const password = 'PruebaTemporal2026!';
let app, admin, institution, discipline, people, accounts, organizer;
const date = hours => new Date(Date.now() + hours * 3600000).toISOString();
const rules = (mode = 'equipo', format = 'liga') => ({ integrantesMin: mode === 'individual' ? 1 : 2, integrantesMax: mode === 'individual' ? 1 : 5, maxInscripciones: 2, metrica: 'puntos', unidad: 'puntos', precision: 0, orden: 'descendente', fases: ['Clasificación', 'Final'], avance: 'Avanzan los dos mejores.', desempates: ['Puntos', 'Sorteo'], pruebas: format === 'pruebas' ? ['100 metros', '200 metros', '400 metros'] : [], requisitos: 'Cuenta e institución activas.', permiteMultiplesEquipos: false });
function write(actor, method, path, body) { return actor.agent[method](`/api/${path}`).set('X-CSRF-Token', actor.csrf).send(body); }
async function create(path, body, actor = admin) { return (await write(actor, 'post', path, body).expect(201)).body.data; }
async function login(user) {
  const agent = request.agent(app);
  const result = await agent.post('/api/auth/login').send({ correo: user.correo, password }).expect(200);
  return { agent, csrf: result.body.data.csrfToken, user: result.body.data.user };
}
function tournament(extra = {}) {
  const mode = extra.unidadInscripcion || 'equipo', format = extra.formato || 'liga';
  return { nombre: 'Copa de demostración', descripcion: 'Competencia de prueba', tipo: 'intercolegiados', disciplina: discipline.id, categoria: discipline.categorias[0].id, unidadInscripcion: mode, formato: format, ciudad: 'Bogotá', departamento: 'Cundinamarca', inicio: date(48), fin: date(72), inscripcionInicio: date(-24), inscripcionFin: date(24), cupos: 10, responsable: organizer.id, reglamento: rules(mode, format), ...extra };
}
function team(extra = {}) { return { nombre: 'Equipo de prueba', tipo: 'deportivo', institucion: institution.id, disciplina: discipline.id, categoria: discipline.categorias[0].id, modalidad: 'equipo', responsable: accounts[0].id, estado: 'activo', integrantes: people.slice(0, 2).map(p => p.id), ...extra }; }
async function open(body = tournament()) {
  const event = await create('torneos', body);
  return (await write(admin, 'patch', `torneos/${event.id}/estado`, { estado: 'inscripciones' }).expect(200)).body.data;
}
function hackathon(extra = {}) {
  return { nombre: 'Hackatón de innovación', descripcion: 'Soluciones para el campus', ciudad: 'Bogotá', departamento: 'Cundinamarca', modalidad: 'hibrida', inicio: date(48), fin: date(120), inscripcionInicio: date(-24), inscripcionFin: date(24), entregaInicio: date(48), entregaFin: date(72), evaluacionInicio: date(80), evaluacionFin: date(100), cupos: 10, integrantesMin: 2, integrantesMax: 4, proyectosPorEquipo: 1, categorias: ['Educación', 'Ambiente'], requisitos: 'Proyecto original', responsable: organizer.id, ...extra };
}

describe('Competencias: flujos y reglas con MongoDB real', () => {
  before(async () => { await mongoose.connect(process.env.TEST_MONGODB_URI || config.mongoUri, { dbName: db, serverSelectionTimeoutMS: 5000 }); await initializeModels(); });
  beforeEach(async () => {
    await Promise.all([User, Session, Institution, ...competitionModels].map(Model => Model.deleteMany({})));
    app = createApp(config);
    const agent = request.agent(app);
    const result = await agent.post('/api/setup/administrador').send({ nombre: 'Admin de prueba', correo: 'admin@example.test', password }).expect(201);
    admin = { agent, csrf: result.body.data.csrfToken, user: result.body.data.user };
    organizer = await create('usuarios', { nombre: 'Organizadora', correo: 'org@example.test', password, rol: 'organizador', estado: 'activo' });
    institution = await create('instituciones', { nombre: 'Colegio de prueba', ciudad: 'Bogotá', departamento: 'Cundinamarca', tipo: 'colegio', estado: 'activo' });
    discipline = await create('disciplinas', { nombre: 'Atletismo y competencias de equipo de prueba', modalidades: ['equipo', 'individual', 'relevo'], formatos: ['liga', 'pruebas', 'rondas'], categorias: [{ nombre: 'Abierta', edadMin: 10, edadMax: 50, genero: 'cualquiera' }], estado: 'activo' });
    people = []; accounts = [];
    for (let i = 0; i < 3; i++) {
      const user = await create('usuarios', { nombre: `Participante ${i}`, correo: `p${i}@example.test`, password, rol: 'participante', estado: 'activo' });
      accounts.push(user);
      people.push(await create('participantes', { documento: `QA${i}`, nombre: user.nombre, nacimiento: '2005-06-01', genero: 'femenino', usuario: user.id, institucion: institution.id, categoria: 'Abierta', estado: 'activo' }));
    }
  });
  after(async () => { if (mongoose.connection.readyState === 1) { assert.equal(mongoose.connection.name, db); assert.match(db, /^codex_campus_test_\d+_[a-f0-9]{12}$/); await mongoose.connection.dropDatabase(); } await mongoose.disconnect(); });

  it('configura disciplinas, rechaza incoherencias y protege categorías utilizadas', async () => {
    const actor = await login(organizer);
    await write(actor, 'post', 'disciplinas', { nombre: 'No autorizado' }).expect(403);
    await write(admin, 'post', 'disciplinas', { nombre: 'Inválida', modalidades: ['partido'], formatos: ['liga'], categorias: [] }).expect(400);
    await create('torneos', tournament());
    await write(admin, 'patch', `disciplinas/${discipline.id}`, { categorias: [{ ...discipline.categorias[0], edadMax: 60 }] }).expect(409);
    await write(admin, 'patch', `disciplinas/${discipline.id}`, { estado: 'inactivo' }).expect(200);
    await write(admin, 'post', 'torneos', tournament()).expect(400);
    assert.equal((await admin.agent.get('/api/disciplinas?estado=inactivo').expect(200)).body.data.total, 1);
  });

  it('crea torneos, valida fechas y permisos, publica y bloquea reglas retroactivas', async () => {
    await write(admin, 'post', 'torneos', tournament({ inicio: date(-48) })).expect(400);
    await write(admin, 'post', 'torneos', tournament({ unidadInscripcion: 'relevo', formato: 'eliminacion' })).expect(400);
    const event = await create('torneos', tournament());
    const participant = await login(accounts[0]);
    await participant.agent.get(`/api/torneos/${event.id}`).expect(404);
    await write(participant, 'patch', `torneos/${event.id}`, { nombre: 'Ajeno' }).expect(403);
    const owner = await login(organizer);
    await write(owner, 'patch', `torneos/${event.id}`, { nombre: 'Copa actualizada' }).expect(200);
    await write(owner, 'patch', `torneos/${event.id}/estado`, { estado: 'inscripciones' }).expect(200);
    await participant.agent.get(`/api/torneos/${event.id}`).expect(200);
    await write(owner, 'patch', `torneos/${event.id}`, { nombre: 'Copa publicada' }).expect(200);
    await write(owner, 'patch', `torneos/${event.id}`, { reglamento: { ...rules(), integrantesMax: 8 } }).expect(409);
    await write(owner, 'patch', `torneos/${event.id}/estado`, { estado: 'finalizado' }).expect(409);
    await write(owner, 'patch', `torneos/${event.id}`, { creadoPor: accounts[0].id }).expect(400);
  });

  it('configura hackatones independientes y equipos tecnológicos con requisitos reales', async () => {
    const actor = await login(organizer);
    await write(actor, 'post', 'hackatones', hackathon()).expect(403);
    await write(admin, 'post', 'hackatones', hackathon({ entregaFin: date(110) })).expect(400);
    const event = await create('hackatones', hackathon());
    await write(actor, 'patch', `hackatones/${event.id}`, { requisitos: 'Demostración y repositorio' }).expect(200);
    await write(actor, 'patch', `hackatones/${event.id}/estado`, { estado: 'inscripciones' }).expect(200);
    const representative = await login(accounts[0]);
    const body = { nombre: 'Ideas Campus', tipo: 'tecnologico', hackaton: event.id, categoriaTecnologica: 'Educación', responsable: accounts[0].id, integrantes: people.slice(0, 2).map(p => p.id), estado: 'activo' };
    await write(representative, 'post', 'equipos', { ...body, integrantes: [people[0].id] }).expect(400);
    const created = await create('equipos', body, representative);
    assert.equal(created.disciplina, undefined);
    await write(representative, 'patch', `equipos/${created.id}`, { nombre: 'Ideas actualizadas' }).expect(200);
    await write(representative, 'patch', `equipos/${created.id}`, { responsable: accounts[1].id }).expect(403);
    assert.equal(await Registration.countDocuments({}), 0);
    assert.equal((await representative.agent.get('/api/hackatones?categoria=Educaci%C3%B3n').expect(200)).body.data.total, 1);
  });

  it('valida participantes únicos, referencias activas, filtros y datos privados', async () => {
    const base = { ...people[0], nacimiento: '2005-06-01' };
    const input = Object.fromEntries(['documento', 'nombre', 'nacimiento', 'genero', 'usuario', 'institucion', 'categoria', 'estado'].map(key => [key, base[key]]));
    await write(admin, 'post', 'participantes', input).expect(409);
    await write(admin, 'patch', `participantes/${people[0].id}`, { nacimiento: '2005-02-30' }).expect(400);
    await write(admin, 'patch', `participantes/${people[0].id}`, { institucion: new mongoose.Types.ObjectId().toString() }).expect(400);
    const filtered = await admin.agent.get(`/api/participantes?institucion=${institution.id}&categoria=Abierta&limit=2`).expect(200);
    assert.equal(filtered.body.data.total, 3); assert.equal(filtered.body.data.items.length, 2); assert.equal(filtered.body.data.pages, 2);
    const actor = await login(accounts[0]);
    await actor.agent.get(`/api/participantes/${people[1].id}`).expect(404);
    const catalogs = (await actor.agent.get('/api/catalogos').expect(200)).body.data;
    assert.ok(catalogs.participantes.every(p => !('documento' in p) && !('nacimiento' in p)));
    await write(admin, 'patch', `instituciones/${institution.id}`, { estado: 'inactivo' }).expect(200);
    const newAccount = await create('usuarios', { nombre: 'Otra participante', correo: 'otra@example.test', password, rol: 'participante', estado: 'activo' });
    await write(admin, 'post', 'participantes', { ...input, documento: 'OTRA', usuario: newAccount.id }).expect(400);
    await admin.agent.get(`/api/participantes/${people[0].id}`).expect(200);
  });

  it('inscribe equipos y relevos, conserva plantilla y evita duplicados y equipos repetidos', async () => {
    const event = await open();
    const first = await create('equipos', team());
    const representative = await login(accounts[0]);
    const body = { torneo: event.id, modalidad: 'equipo', competidor: first.id };
    const registration = await create('inscripciones', body, representative);
    assert.equal(registration.estado, 'confirmada'); assert.equal(registration.plantilla.length, 2);
    await write(representative, 'post', 'inscripciones', body).expect(409);
    await write(admin, 'patch', `equipos/${first.id}`, { integrantes: people.map(p => p.id) }).expect(409);
    const second = await create('equipos', team({ nombre: 'Segundo equipo' }));
    await write(admin, 'post', 'inscripciones', { ...body, competidor: second.id }).expect(409);
    const relayEvent = await open(tournament({ nombre: 'Relevos', unidadInscripcion: 'relevo', formato: 'pruebas' }));
    const relay = await create('equipos', team({ nombre: 'Relevo', modalidad: 'relevo' }));
    await create('inscripciones', { torneo: relayEvent.id, modalidad: 'relevo', competidor: relay.id, prueba: '100 metros' });
    const listed = await representative.agent.get(`/api/inscripciones?torneo=${event.id}`).expect(200);
    assert.equal(listed.body.data.items[0].competidorNombre, first.nombre);
    assert.equal(listed.body.data.items[0].plantilla.some(p => p.documento || p.nacimiento), false);
  });

  it('inscribe individuales por prueba, comprueba edad al inicio y límites por competidor', async () => {
    const event = await open(tournament({ unidadInscripcion: 'individual', formato: 'pruebas' }));
    const actor = await login(accounts[0]);
    const body = { torneo: event.id, modalidad: 'individual', competidor: people[0].id, prueba: '100 metros' };
    await write(actor, 'post', 'inscripciones', { ...body, competidor: people[1].id }).expect(403);
    await write(actor, 'post', 'inscripciones', { ...body, prueba: 'No existe' }).expect(400);
    await create('inscripciones', body, actor);
    await create('inscripciones', { ...body, prueba: '200 metros' }, actor);
    await write(actor, 'post', 'inscripciones', { ...body, prueba: '400 metros' }).expect(409);
    await Participant.updateOne({ _id: people[1].id }, { nacimiento: new Date('2020-01-01') });
    await write(admin, 'post', 'inscripciones', { ...body, competidor: people[1].id }).expect(400);
    await write(admin, 'patch', `instituciones/${institution.id}`, { estado: 'inactivo' }).expect(200);
    await write(admin, 'post', 'inscripciones', { ...body, competidor: people[2].id }).expect(400);
  });

  it('reserva el último cupo ante concurrencia y combina filtros de eventos', async () => {
    const event = await open(tournament({ unidadInscripcion: 'individual', formato: 'pruebas', cupos: 1 }));
    const attempts = await Promise.all(people.slice(0, 2).map(p => write(admin, 'post', 'inscripciones', { torneo: event.id, modalidad: 'individual', competidor: p.id, prueba: '100 metros' })));
    assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
    assert.equal(await Registration.countDocuments({ torneo: event.id }), 1);
    await create('torneos', tournament({ nombre: 'Borrador universitario', tipo: 'universitario' }));
    const listed = await admin.agent.get('/api/torneos?tipo=intercolegiados&estado=inscripciones&limit=1').expect(200);
    assert.equal(listed.body.data.total, 1); assert.equal(listed.body.data.items[0].inscritos, 1);
    const closed = await create('torneos', tournament({ nombre: 'Aún cerrado' }));
    await write(admin, 'post', 'inscripciones', { torneo: closed.id, modalidad: 'equipo', competidor: people[0].id }).expect(409);
  });

  it('conserva equipos históricos al desactivar referencias y bloquea nuevas asociaciones', async () => {
    const existing = await create('equipos', team());
    await write(admin, 'patch', `equipos/${existing.id}`, { integrantes: 'valor inválido' }).expect(400);
    await write(admin, 'patch', `instituciones/${institution.id}`, { estado: 'inactivo' }).expect(200);
    await write(admin, 'patch', `equipos/${existing.id}`, { nombre: 'Equipo conservado', estado: 'inactivo' }).expect(200);
    await write(admin, 'post', 'equipos', team({ nombre: 'No permitido' })).expect(400);
    const record = await admin.agent.get(`/api/equipos/${existing.id}`).expect(200);
    assert.equal(record.body.data.integrantes.length, 2);
    app = createApp(config);
    const reconnected = await login(admin.user);
    const persisted = await reconnected.agent.get(`/api/equipos/${existing.id}`).expect(200);
    assert.equal(persisted.body.data.nombre, 'Equipo conservado');
  });

  it('impide al organizador acceder o modificar borradores ajenos y al jurado datos privados', async () => {
    const other = await create('usuarios', { nombre: 'Otra organizadora', correo: 'otro-org@example.test', password, rol: 'organizador', estado: 'activo' });
    const actor = await login(other);
    const event = await create('torneos', tournament());
    await actor.agent.get(`/api/torneos/${event.id}`).expect(404);
    await write(actor, 'patch', `torneos/${event.id}`, { nombre: 'No autorizado' }).expect(403);
    await write(actor, 'post', 'torneos', tournament()).expect(403);
    const jurorUser = await create('usuarios', { nombre: 'Jurado', correo: 'jurado@example.test', password, rol: 'jurado', estado: 'activo' });
    const juror = await login(jurorUser);
    await juror.agent.get('/api/participantes').expect(403);
    const catalog = (await juror.agent.get('/api/catalogos').expect(200)).body.data;
    assert.deepEqual(catalog.participantes, []); assert.deepEqual(catalog.equipos, []);
    assert.equal(catalog.torneos.length, 0);
  });

  it('rechaza integrantes duplicados, institución incompatible y cuentas inactivas al inscribir', async () => {
    await write(admin, 'post', 'equipos', team({ integrantes: [people[0].id, people[0].id] })).expect(400);
    const other = await create('instituciones', { nombre: 'Otra institución', ciudad: 'Bogotá', departamento: 'Cundinamarca', tipo: 'universidad', estado: 'activo' });
    await write(admin, 'post', 'equipos', team({ institucion: other.id })).expect(400);
    const event = await open(); const existing = await create('equipos', team());
    await write(admin, 'patch', `usuarios/${accounts[1].id}`, { estado: 'inactivo' }).expect(200);
    await write(admin, 'post', 'inscripciones', { torneo: event.id, modalidad: 'equipo', competidor: existing.id }).expect(400);
    assert.equal(await Registration.countDocuments({}), 0);
  });
});
