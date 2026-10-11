import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { User, Session, Institution, initializeModels } from '../src/models.js';
import { hashPassword } from '../src/security.js';

const testDb = `codex_campus_test_${process.pid}_${randomBytes(6).toString('hex')}`;
const config = { ...readConfig(), allowInitialSetup: true, production: false };
const adminInput = { nombre: 'Administradora de prueba', correo: 'admin@example.test', password: 'PruebaTemporal2026!' };
const institution = { nombre: 'Institución Técnica', ciudad: 'Bogotá', departamento: 'Cundinamarca', tipo: 'colegio', estado: 'activo' };
let app;

async function bootstrap() {
  const agent = request.agent(app);
  const result = await agent.post('/api/setup/administrador').send(adminInput).expect(201);
  return { agent, csrf: result.body.data.csrfToken, user: result.body.data.user, cookie: result.headers['set-cookie'][0].split(';')[0] };
}

describe('API con MongoDB real en una base temporal aislada', () => {
  before(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || config.mongoUri, { dbName: testDb, serverSelectionTimeoutMS: 5000 });
    await initializeModels();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Session.deleteMany({}), Institution.deleteMany({})]);
    app = createApp(config);
  });
  after(async () => {
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, testDb);
      assert.ok(testDb.startsWith('codex_campus_test_'));
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it('rechaza acceso sin sesión y solo permite un administrador inicial ante concurrencia', async () => {
    await request(app).get('/api/instituciones').expect(401);
    const attempts = await Promise.all([
      request(app).post('/api/setup/administrador').send(adminInput),
      request(app).post('/api/setup/administrador').send({ ...adminInput, correo: 'segundo@example.test' }),
    ]);
    assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
    assert.equal(await User.countDocuments({}), 1);
    const status = await request(app).get('/api/setup/status').expect(200);
    assert.equal(status.body.data.needsSetup, false);
  });

  it('valida el alta y guarda un hash sin aceptar privilegios enviados por el cliente', async () => {
    await request(app).post('/api/setup/administrador').send({ ...adminInput, password: 'corta' }).expect(400);
    const response = await request(app).post('/api/setup/administrador').send({ ...adminInput, estado: 'inactivo' }).expect(201);
    assert.equal(response.body.data.user.estado, 'activo');
    assert.equal(response.body.data.user.rol, 'administrador');
    assert.equal('passwordHash' in response.body.data.user, false);
    const user = await User.findOne({}).select('+passwordHash');
    assert.notEqual(user.passwordHash, adminInput.password);
    assert.ok(user.passwordHash.startsWith('scrypt$'));
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
  });

  it('inicia sesión con correo normalizado y el cierre invalida la cookie anterior', async () => {
    await bootstrap();
    await request(app).post('/api/auth/login').send({ ...adminInput, password: 'incorrecta' }).expect(401);
    await request(app).post('/api/auth/login').send({ correo: 'inexistente@example.test', password: 'incorrecta' }).expect(401);
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ ...adminInput, correo: 'ADMIN@EXAMPLE.TEST' }).expect(200);
    const oldCookie = login.headers['set-cookie'][0].split(';')[0];
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal('passwordHash' in me.body.data.user, false);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', me.body.data.csrfToken).send({}).expect(200);
    await request(app).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
  });

  it('bloquea escrituras sin token CSRF y solicitudes de otro origen', async () => {
    const { agent, csrf } = await bootstrap();
    await agent.post('/api/instituciones').send(institution).expect(403);
    await agent.post('/api/instituciones').set('X-CSRF-Token', 'invalido').send(institution).expect(403);
    await agent.post('/api/instituciones').set('X-CSRF-Token', csrf).set('Origin', 'https://otra-pagina.example').send(institution).expect(403);
    await agent.post('/api/instituciones').set('X-CSRF-Token', csrf).set('Origin', config.clientOrigin).send(institution).expect(201);
  });

  it('permite consulta a participantes y rechaza escritura o consulta de otro perfil', async () => {
    const admin = await bootstrap();
    const participant = await User.create({ nombre: 'Participante de prueba', correo: 'participante@example.test', passwordHash: await hashPassword(adminInput.password), rol: 'participante' });
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ correo: participant.correo, password: adminInput.password }).expect(200);
    await agent.get('/api/instituciones').expect(200);
    await agent.get(`/api/usuarios/${participant._id}`).expect(200);
    await agent.get(`/api/usuarios/${admin.user.id}`).expect(403);
    await agent.post('/api/instituciones').set('X-CSRF-Token', login.body.data.csrfToken).send(institution).expect(403);
  });

  it('aplica desactivaciones y vencimientos a sesiones existentes', async () => {
    const first = await bootstrap();
    await User.updateOne({ _id: first.user.id }, { estado: 'inactivo' });
    await first.agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').send(adminInput).expect(401);
    await User.updateOne({ _id: first.user.id }, { estado: 'activo' });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(adminInput).expect(200);
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    await agent.get('/api/auth/me').expect(401);
  });

  it('registra, filtra, actualiza y desactiva instituciones conservando el registro', async () => {
    const { agent, csrf } = await bootstrap();
    await agent.post('/api/instituciones').set('X-CSRF-Token', csrf).send({ ...institution, nombre: '' }).expect(400);
    const created = await agent.post('/api/instituciones').set('X-CSRF-Token', csrf).send(institution).expect(201);
    assert.ok(created.body.data.id);
    assert.equal('clave' in created.body.data, false);
    const found = await agent.get('/api/instituciones?q=Técnica').expect(200);
    assert.equal(found.body.data.total, 1);
    assert.equal(found.body.data.summary.active, 1);
    await agent.patch(`/api/instituciones/${created.body.data.id}`).set('X-CSRF-Token', csrf).send({ estado: 'inactivo' }).expect(200);
    const active = await agent.get('/api/instituciones?estado=activo').expect(200);
    assert.equal(active.body.data.total, 0);
    assert.equal(active.body.data.summary.total, 1);
    const inactive = await agent.get('/api/instituciones?estado=inactivo').expect(200);
    assert.equal(inactive.body.data.items[0].estado, 'inactivo');
  });

  it('rechaza duplicados de institución, incluso con mayúsculas y tildes diferentes', async () => {
    const { agent, csrf } = await bootstrap();
    const attempts = await Promise.all([
      agent.post('/api/instituciones').set('X-CSRF-Token', csrf).send(institution),
      agent.post('/api/instituciones').set('X-CSRF-Token', csrf).send({ ...institution, nombre: 'INSTITUCION TECNICA', ciudad: 'Bogota' }),
    ]);
    assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
    assert.equal(await Institution.countDocuments({}), 1);
  });

  it('valida paginación e identificadores y escapa caracteres especiales de búsqueda', async () => {
    const { agent, csrf } = await bootstrap();
    await agent.get('/api/instituciones?limit=500').expect(400);
    await agent.get('/api/instituciones?page=-1').expect(400);
    await agent.get('/api/instituciones?q=%5B.*').expect(200);
    await agent.patch('/api/instituciones/incorrecto').set('X-CSRF-Token', csrf).send(institution).expect(400);
    await agent.patch('/api/instituciones/000000000000000000000000').set('X-CSRF-Token', csrf).send(institution).expect(404);
  });

  it('mantiene sesión y registros al crear otra instancia de la aplicación', async () => {
    const { agent, csrf, cookie } = await bootstrap();
    await agent.post('/api/instituciones').set('X-CSRF-Token', csrf).send(institution).expect(201);
    const anotherApp = createApp(config);
    const response = await request(anotherApp).get('/api/instituciones').set('Cookie', cookie).expect(200);
    assert.equal(response.body.data.total, 1);
  });

  it('deshabilita el alta inicial en producción', async () => {
    const productionConfig = readConfig({ NODE_ENV: 'production', ALLOW_INITIAL_SETUP: 'true' });
    assert.equal(productionConfig.allowInitialSetup, false);
    await request(createApp(productionConfig)).post('/api/setup/administrador').send(adminInput).expect(404);
  });

  it('crea cuentas de los cuatro roles, con correos únicos y sin exponer información interna', async () => {
    const { agent, csrf } = await bootstrap();
    for (const rol of ['administrador', 'organizador', 'participante', 'jurado']) {
      const created = await agent.post('/api/usuarios').set('X-CSRF-Token', csrf).send({ nombre: `Persona ${rol}`, correo: ` ${rol.toUpperCase()}@example.test `, rol, estado: 'activo', password: adminInput.password }).expect(201);
      assert.equal(created.body.data.correo, `${rol}@example.test`);
      assert.equal(created.body.data.rol, rol);
      assert.deepEqual(Object.keys(created.body.data).sort(), ['correo', 'estado', 'id', 'nombre', 'rol']);
    }
    await agent.post('/api/usuarios').set('X-CSRF-Token', csrf).send({ nombre: 'Duplicada', correo: 'JURADO@EXAMPLE.TEST', rol: 'jurado', estado: 'activo', password: adminInput.password }).expect(409);
    const list = await agent.get('/api/usuarios').expect(200);
    assert.equal(list.body.data.total, 5);
    assert.deepEqual(list.body.data.summary, { total: 5, active: 5, admins: 2 });
  });

  it('protege el listado y las escrituras de usuarios frente a cuentas sin autorización y sin CSRF', async () => {
    await request(app).get('/api/usuarios').expect(401);
    const admin = await bootstrap();
    await admin.agent.post('/api/usuarios').send({}).expect(403);
    await admin.agent.patch('/api/usuarios/me').send({ nombre: 'Otro nombre' }).expect(403);
    for (const rol of ['organizador', 'participante', 'jurado']) {
      const input = { nombre: `Persona ${rol}`, correo: `${rol}@example.test`, rol, estado: 'activo', password: adminInput.password };
      const created = await admin.agent.post('/api/usuarios').set('X-CSRF-Token', admin.csrf).send(input).expect(201);
      const agent = request.agent(app);
      const login = await agent.post('/api/auth/login').send(input).expect(200);
      const csrf = login.body.data.csrfToken;
      await agent.get('/api/usuarios').expect(403);
      await agent.post('/api/usuarios').set('X-CSRF-Token', csrf).send(input).expect(403);
      await agent.patch(`/api/usuarios/${created.body.data.id}`).set('X-CSRF-Token', csrf).send({ rol: 'administrador' }).expect(403);
      await agent.get(`/api/usuarios/${created.body.data.id}`).expect(200);
    }
  });

  it('valida cuentas, roles, estados, paginación e identificadores antes de modificarlos', async () => {
    const { agent, csrf } = await bootstrap();
    const input = { nombre: 'Persona de prueba', correo: 'nueva@example.test', rol: 'participante', estado: 'activo', password: adminInput.password };
    for (const invalid of [{ nombre: '' }, { correo: 'no-es-correo' }, { rol: 'superadmin' }, { estado: 'desconocido' }, { password: 'corta' }, { bootstrapAdmin: true }]) {
      await agent.post('/api/usuarios').set('X-CSRF-Token', csrf).send({ ...input, ...invalid }).expect(400);
    }
    await agent.get('/api/usuarios?rol=desconocido').expect(400);
    await agent.get('/api/usuarios?estado=desconocido').expect(400);
    await agent.get('/api/usuarios?limit=500').expect(400);
    await agent.get('/api/usuarios?page=-1').expect(400);
    await agent.patch('/api/usuarios/incorrecto').set('X-CSRF-Token', csrf).send({ nombre: 'Válido' }).expect(400);
    await agent.patch('/api/usuarios/000000000000000000000000').set('X-CSRF-Token', csrf).send({ nombre: 'Válido' }).expect(404);
    assert.equal(await User.countDocuments({}), 1);
  });

  it('combina búsqueda y filtros de usuarios con paginación y contadores reales', async () => {
    const { agent, csrf } = await bootstrap();
    for (const [nombre, correo, rol, estado] of [['Ana Jurado', 'ana@example.test', 'jurado', 'activo'], ['Beto Jurado', 'beto@example.test', 'jurado', 'inactivo'], ['Ana Organización', 'otra@example.test', 'organizador', 'activo']]) {
      await agent.post('/api/usuarios').set('X-CSRF-Token', csrf).send({ nombre, correo, rol, estado, password: adminInput.password }).expect(201);
    }
    const filtered = await agent.get('/api/usuarios?q=ana&rol=jurado&estado=activo').expect(200);
    assert.equal(filtered.body.data.total, 1);
    assert.equal(filtered.body.data.items[0].correo, 'ana@example.test');
    const page = await agent.get('/api/usuarios?rol=jurado&limit=1&page=2').expect(200);
    assert.equal(page.body.data.pages, 2);
    assert.equal(page.body.data.items[0].nombre, 'Beto Jurado');
    assert.deepEqual(page.body.data.summary, { total: 4, active: 3, admins: 1 });
    assert.equal((await agent.get('/api/usuarios?q=%5B.*').expect(200)).body.data.total, 0);
  });

  it('aplica cambios de rol a sesiones existentes y revoca acceso al desactivar cuentas', async () => {
    const admin = await bootstrap();
    const input = { nombre: 'Responsable', correo: 'responsable@example.test', rol: 'participante', estado: 'activo', password: adminInput.password };
    const created = await admin.agent.post('/api/usuarios').set('X-CSRF-Token', admin.csrf).send(input).expect(201);
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send(input).expect(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    await agent.get('/api/usuarios').expect(403);
    await admin.agent.patch(`/api/usuarios/${created.body.data.id}`).set('X-CSRF-Token', admin.csrf).send({ rol: 'administrador' }).expect(200);
    await agent.get('/api/usuarios').expect(200);
    await admin.agent.patch(`/api/usuarios/${created.body.data.id}`).set('X-CSRF-Token', admin.csrf).send({ estado: 'inactivo' }).expect(200);
    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').send(input).expect(401);
    await admin.agent.patch(`/api/usuarios/${created.body.data.id}`).set('X-CSRF-Token', admin.csrf).send({ estado: 'activo' }).expect(200);
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    await request(app).post('/api/auth/login').send(input).expect(200);
    assert.equal(await User.countDocuments({ _id: created.body.data.id }), 1);
  });

  it('impide desactivar la cuenta propia y retirar el último administrador activo', async () => {
    const { agent, csrf, user } = await bootstrap();
    const self = await agent.patch(`/api/usuarios/${user.id}`).set('X-CSRF-Token', csrf).send({ estado: 'inactivo' }).expect(409);
    assert.equal(self.body.error.code, 'SELF_DEACTIVATION');
    const last = await agent.patch(`/api/usuarios/${user.id}`).set('X-CSRF-Token', csrf).send({ rol: 'participante' }).expect(409);
    assert.equal(last.body.error.code, 'LAST_ADMIN');
    assert.equal(await User.countDocuments({ rol: 'administrador', estado: 'activo' }), 1);
  });

  it('conserva un administrador ante cambios simultáneos y revalida permisos dentro de la operación', async () => {
    const first = await bootstrap();
    const input = { nombre: 'Segundo administrador', correo: 'segundo@example.test', rol: 'administrador', estado: 'activo', password: adminInput.password };
    const created = await first.agent.post('/api/usuarios').set('X-CSRF-Token', first.csrf).send(input).expect(201);
    const second = request.agent(app);
    const login = await second.post('/api/auth/login').send(input).expect(200);
    const responses = await Promise.all([
      first.agent.patch(`/api/usuarios/${created.body.data.id}`).set('X-CSRF-Token', first.csrf).send({ rol: 'participante' }),
      second.patch(`/api/usuarios/${first.user.id}`).set('X-CSRF-Token', login.body.data.csrfToken).send({ rol: 'participante' }),
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 403]);
    assert.equal(await User.countDocuments({ rol: 'administrador', estado: 'activo' }), 1);
  });

  it('un cambio de contraseña invalida las sesiones anteriores y conserva el hash privado', async () => {
    const admin = await bootstrap();
    const input = { nombre: 'Persona', correo: 'persona@example.test', rol: 'participante', estado: 'activo', password: adminInput.password };
    const created = await admin.agent.post('/api/usuarios').set('X-CSRF-Token', admin.csrf).send(input).expect(201);
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send(input).expect(200);
    const oldUser = await User.findById(created.body.data.id).select('+authVersion');
    const changed = await admin.agent.patch(`/api/usuarios/${created.body.data.id}`).set('X-CSRF-Token', admin.csrf).send({ password: 'NuevaPrueba2026!' }).expect(200);
    assert.equal('passwordHash' in changed.body.data, false);
    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').send(input).expect(401);
    await request(app).post('/api/auth/login').send({ ...input, password: 'NuevaPrueba2026!' }).expect(200);
    // Simula una autenticación que comenzó antes del cambio y terminó después.
    const staleToken = 's'.repeat(43);
    const { createHash } = await import('node:crypto');
    await Session.create({ usuario: oldUser._id, authVersion: oldUser.authVersion, tokenHash: createHash('sha256').update(staleToken).digest('hex'), csrfToken: 'test', expiresAt: new Date(Date.now() + 60000) });
    await request(app).get('/api/auth/me').set('Cookie', `campus_session=${staleToken}`).expect(401);
    assert.ok(login.body.data.csrfToken);
  });

  it('actualiza el perfil propio y exige contraseña actual para cambiar el correo', async () => {
    const { agent, csrf, user } = await bootstrap();
    await agent.patch('/api/usuarios/me').set('X-CSRF-Token', csrf).send({ nombre: 'Nombre actualizado' }).expect(200);
    await agent.patch('/api/usuarios/me').set('X-CSRF-Token', csrf).send({ correo: 'nuevo@example.test' }).expect(400);
    await agent.patch('/api/usuarios/me').set('X-CSRF-Token', csrf).send({ correo: 'nuevo@example.test', currentPassword: 'incorrecta' }).expect(400);
    const response = await agent.patch('/api/usuarios/me').set('X-CSRF-Token', csrf).send({ correo: ' NUEVO@EXAMPLE.TEST ', currentPassword: adminInput.password }).expect(200);
    assert.equal(response.body.data.correo, 'nuevo@example.test');
    assert.equal(response.body.data.nombre, 'Nombre actualizado');
    assert.deepEqual(Object.keys(response.body.data).sort(), ['correo', 'estado', 'id', 'nombre', 'rol']);
    await agent.get(`/api/usuarios/${user.id.toUpperCase()}`).expect(200);
    await request(app).post('/api/auth/login').send(adminInput).expect(401);
    await request(app).post('/api/auth/login').send({ correo: 'nuevo@example.test', password: adminInput.password }).expect(200);
  });

  it('rechaza cambios de privilegios desde el perfil y correos duplicados sin modificar la cuenta', async () => {
    const admin = await bootstrap();
    const input = { nombre: 'Participante', correo: 'persona@example.test', rol: 'participante', estado: 'activo', password: adminInput.password };
    const created = await admin.agent.post('/api/usuarios').set('X-CSRF-Token', admin.csrf).send(input).expect(201);
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send(input).expect(200);
    const csrf = login.body.data.csrfToken;
    for (const field of [{ rol: 'administrador' }, { estado: 'inactivo' }, { id: admin.user.id }, { passwordHash: 'falso' }, { authVersion: 0 }]) {
      await agent.patch('/api/usuarios/me').set('X-CSRF-Token', csrf).send({ nombre: 'Cambiado', ...field }).expect(400);
    }
    await agent.patch('/api/usuarios/me').set('X-CSRF-Token', csrf).send({ nombre: 'Cambiado', correo: 'ADMIN@EXAMPLE.TEST', currentPassword: input.password }).expect(409);
    const user = await User.findById(created.body.data.id);
    assert.equal(user.nombre, input.nombre);
    assert.equal(user.correo, input.correo);
    assert.equal(user.rol, 'participante');
    assert.equal(user.estado, 'activo');
  });
});
