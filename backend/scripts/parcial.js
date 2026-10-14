import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { User, Institution, initializeModels } from '../src/models.js';
import { Discipline, Tournament, Hackathon, Participant, Team, Registration } from '../src/competition-models.js';
import { hashPassword } from '../src/security.js';
import { crearSolicitudes, cuerpoEquipo, cuerpoTorneo } from '../parcial/solicitudes.js';

const modo = process.argv[2];
const directorio = fileURLToPath(new URL('../../tmp/parcial-2/', import.meta.url));
const base = process.env.PARCIAL_DB_NAME || 'campus_parcial_demo';
if (!/^(campus_parcial_demo|codex_campus_parcial_test_\d+_[a-f0-9]{12})$/.test(base)) {
  throw new Error('El ensayo solo permite la base campus_parcial_demo o una base temporal de pruebas.');
}
const uri = `mongodb://127.0.0.1:27017/${base}`;
let servidor;
let cerrando = false;
async function cerrar() {
  if (cerrando) return;
  cerrando = true;
  if (servidor) await new Promise(resolve => servidor.close(resolve));
  await mongoose.disconnect();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await cerrar(); process.exit(0); });

async function ejecutar(peticion) {
  const inicio = performance.now();
  const respuesta = await fetch(peticion.url, { method: peticion.metodo, headers: peticion.headers, ...(peticion.cuerpo ? { body: JSON.stringify(peticion.cuerpo) } : {}), signal: AbortSignal.timeout(10000) });
  const contenido = await respuesta.json();
  assert.equal(respuesta.status, peticion.estado, `${peticion.titulo}: ${contenido.error?.message || 'estado inesperado'}`);
  assert.match(respuesta.headers.get('content-type'), /application\/json/);
  return { contenido, respuesta, duracionMs: Math.round(performance.now() - inicio) };
}

async function comprobarPersistencia(contexto, numero) {
  const pasos = crearSolicitudes(contexto).principales;
  const peticion = pasos[numero - 1];
  let coleccion, documento;
  if (numero === 1) { coleccion = 'usuarios'; documento = await User.findById(contexto.actores.participante.id).lean(); assert.ok(documento); }
  if (numero === 2) { coleccion = 'instituciones'; documento = await Institution.findById(contexto.institucionEliminarId).lean(); assert.equal(documento, null, 'La institución todavía existe. Ejecuta la petición 02.'); }
  if (numero === 3) { coleccion = 'disciplinas'; documento = await Discipline.findOne({ nombre: peticion.cuerpo.nombre }).lean(); assert.ok(documento, 'Ejecuta la petición 03.'); assert.deepEqual(documento.modalidades, ['equipo']); assert.equal(documento.categorias[0].nombre, 'Juvenil'); }
  if (numero === 4) { coleccion = 'torneos'; documento = await Tournament.findOne({ nombre: peticion.cuerpo.nombre }).lean(); assert.ok(documento, 'Ejecuta la petición 04.'); assert.equal(String(documento.disciplina), contexto.disciplinaId); assert.ok(documento.inicio instanceof Date); }
  if (numero === 5) { coleccion = 'hackatones'; documento = await Hackathon.findOne({ nombre: peticion.cuerpo.nombre }).lean(); assert.ok(documento, 'Ejecuta la petición 05.'); assert.equal(documento.proyectosPorEquipo, 1); assert.equal(String(documento.responsable), contexto.actores.organizador.id); }
  if (numero === 6) { coleccion = 'torneos'; documento = await Tournament.findById(contexto.torneoReglasId).lean(); assert.deepEqual(documento.reglamento.fases, peticion.cuerpo.reglamento.fases, 'Ejecuta la petición 06.'); assert.ok(documento.reglamentoVersion >= 2); }
  if (numero === 7) { coleccion = 'participantes'; documento = await Participant.findOne({ documento: peticion.cuerpo.documento }).lean(); assert.ok(documento, 'Ejecuta la petición 07.'); assert.equal(String(documento.usuario), contexto.usuarioNuevoId); assert.equal(String(documento.institucion), contexto.institucionId); }
  if (numero === 8) { coleccion = 'equipos'; documento = await Team.findOne({ nombre: peticion.cuerpo.nombre }).lean(); assert.ok(documento, 'Ejecuta la petición 08.'); assert.deepEqual(documento.integrantes.map(String), contexto.integrantes); }
  if (numero === 9) { coleccion = 'torneos'; documento = await Tournament.findById(contexto.torneoAbiertoId).lean(); assert.equal(documento.estado, 'inscripciones'); }
  if (numero === 10) { coleccion = 'inscripciones'; documento = await Registration.findOne({ torneo: contexto.torneoAbiertoId, competidor: contexto.equipoBaseId }).lean(); assert.ok(documento, 'Ejecuta la petición 10.'); assert.equal(documento.estado, 'confirmada'); assert.equal(documento.plantilla.length, 5); }
  return { paso: numero, base: mongoose.connection.name, coleccion, resultado: numero === 2 ? 'Registro ausente después de DELETE' : 'Registro persistido en MongoDB', id: documento ? String(documento._id) : contexto.institucionEliminarId };
}

function coleccionImportable(solicitudes) {
  const item = peticion => ({ name: `${String(peticion.numero).padStart(2, '0')} ${peticion.historia?.id || ''} ${peticion.titulo}`.trim(), request: { method: peticion.metodo, header: Object.entries(peticion.headers).map(([key, value]) => ({ key, value, type: 'text' })), url: peticion.url, description: `${peticion.historia?.historia || peticion.titulo}\n\nResultado esperado: HTTP ${peticion.estado}.`, ...(peticion.cuerpo ? { body: { mode: 'raw', raw: JSON.stringify(peticion.cuerpo, null, 2), options: { raw: { language: 'json' } } } } : {}) } });
  return { info: { name: 'Campus - Parcial 2 - Thunder Client', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Formato Postman 2.1 compatible con la importación de Thunder Client. Contiene únicamente sesiones ficticias de una base de ensayo local.' }, item: [{ name: '01 Demostración - 10 funcionalidades', item: solicitudes.principales.map(item) }, { name: '02 Reserva - CRUD, errores y autenticación', item: solicitudes.reserva.map(item) }] };
}

function guiaManual(contexto, solicitudes) {
  const bloques = peticion => {
    const filtro = peticion.numero === 2 ? `{ _id: ObjectId("${contexto.institucionEliminarId}") }` : peticion.numero === 6 ? `{ _id: ObjectId("${contexto.torneoReglasId}") }` : peticion.numero === 10 ? `{ torneo: ObjectId("${contexto.torneoAbiertoId}"), competidor: ObjectId("${contexto.equipoBaseId}") }` : peticion.cuerpo?.nombre ? JSON.stringify({ nombre: peticion.cuerpo.nombre }, null, 2) : null;
    return `## ${String(peticion.numero).padStart(2, '0')} ${peticion.historia?.id || ''} ${peticion.titulo}\n\n${peticion.historia?.historia || ''}\n\nMétodo: **${peticion.metodo}**. Resultado esperado: **${peticion.estado}**. Rol: **${peticion.actor || 'público'}**.\n\nURL:\n\n\`\`\`text\n${peticion.url}\n\`\`\`\n\nHeaders (cada línea es una fila de Key y Value):\n\n\`\`\`text\n${Object.entries(peticion.headers).map(([key, value]) => `${key}: ${value}`).join('\n') || 'Sin encabezados especiales.'}\n\`\`\`\n${peticion.cuerpo ? `\nBody > JSON:\n\n\`\`\`json\n${JSON.stringify(peticion.cuerpo, null, 2)}\n\`\`\`\n` : '\nSin Body.\n'}${filtro ? `\nFiltro para Compass:\n\n\`\`\`javascript\n${filtro}\n\`\`\`\n` : ''}\n`;
  };
  return `# Peticiones locales para Thunder Client\n\nBase: **${contexto.base}**. API: **${contexto.apiUrl}**. Preparado: ${contexto.preparadoEn}.\n\nSesiones de ensayo válidas hasta ${contexto.sesionesHasta}. Estos archivos contienen cookies ficticias; permanecen en tmp, excluido de Git.\n\nCrea y guarda estas peticiones en Thunder Client antes de cronometrar la exposición. También puedes importar Campus_Parcial_2.import.json si tu versión permite importar.\n\nLos recursos relacionados ya existen en MongoDB. Los torneos y equipos nuevos de las peticiones 04 y 08 son independientes del torneo abierto y equipo base utilizados en la petición 10.\n\n${[...solicitudes.principales, ...solicitudes.reserva].map(bloques).join('\n')}`;
}

async function preparar() {
  const puerto = Number(process.env.PARCIAL_PORT || 3002);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('PARCIAL_PORT inválido.');
  const config = { ...readConfig(), port: puerto, mongoUri: uri, production: false, allowInitialSetup: false };
  const passwordDemo = 'EnsayoCampus2026!';
  const correoAdmin = 'admin.parcial@example.test';
  if (!await User.exists({ correo: correoAdmin })) await User.create({ nombre: 'Administrador de ensayo', correo: correoAdmin, passwordHash: await hashPassword(passwordDemo), rol: 'administrador', estado: 'activo' });
  servidor = await new Promise((resolve, reject) => { const servicio = createApp(config).listen(puerto, '127.0.0.1', () => resolve(servicio)); servicio.once('error', reject); });
  const apiUrl = `http://127.0.0.1:${puerto}/api`;
  const sufijo = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  async function login(correo) {
    const { respuesta, contenido } = await ejecutar({ titulo: 'Inicio de sesión de ensayo', metodo: 'POST', url: `${apiUrl}/auth/login`, headers: { 'Content-Type': 'application/json' }, cuerpo: { correo, password: passwordDemo }, estado: 200 });
    return { id: contenido.data.user.id, correo, cookie: respuesta.headers.get('set-cookie').split(';')[0], csrf: contenido.data.csrfToken };
  }
  const administrador = await login(correoAdmin);
  async function crear(recurso, cuerpo, actor = administrador) {
    return (await ejecutar({ titulo: `Preparación de ${recurso}`, metodo: 'POST', url: `${apiUrl}/${recurso}`, headers: { 'Content-Type': 'application/json', Cookie: actor.cookie, 'X-CSRF-Token': actor.csrf }, cuerpo, estado: 201 })).contenido.data;
  }
  const cuentaOrg = await crear('usuarios', { nombre: `Organizador Parcial ${sufijo}`, correo: `org.${sufijo}@example.test`, password: passwordDemo, rol: 'organizador', estado: 'activo' });
  const organizador = await login(cuentaOrg.correo);
  const institucion = await crear('instituciones', { nombre: `Colegio Campus Parcial ${sufijo}`, ciudad: 'Barranquilla', departamento: 'Atlántico', tipo: 'colegio', estado: 'activo' });
  const institucionEliminar = await crear('instituciones', { nombre: `Colegio sin participantes Parcial ${sufijo}`, ciudad: 'Barranquilla', departamento: 'Atlántico', tipo: 'colegio', estado: 'activo' });
  const disciplina = await crear('disciplinas', { nombre: `Fútbol 5 base Parcial ${sufijo}`, modalidades: ['equipo'], formatos: ['liga', 'grupos'], categorias: [{ nombre: 'Juvenil', edadMin: 15, edadMax: 18, genero: 'cualquiera' }], estado: 'activo' });
  const nacimientoDemo = `${new Date().getUTCFullYear() - 17}-06-01`;
  const integrantes = [];
  let participante;
  for (let indice = 1; indice <= 5; indice++) {
    const cuenta = await crear('usuarios', { nombre: `Deportista ${indice} Parcial ${sufijo}`, correo: `p${indice}.${sufijo}@example.test`, password: passwordDemo, rol: 'participante', estado: 'activo' });
    const persona = await crear('participantes', { documento: `PAR-${sufijo}-${indice}`.toUpperCase(), nombre: cuenta.nombre, nacimiento: nacimientoDemo, genero: 'femenino', usuario: cuenta.id, institucion: institucion.id, categoria: 'Juvenil', estado: 'activo' }, organizador);
    integrantes.push(persona.id);
    if (indice === 1) participante = await login(cuenta.correo);
  }
  const cuentaNueva = await crear('usuarios', { nombre: `Participante nuevo Parcial ${sufijo}`, correo: `nuevo.${sufijo}@example.test`, password: passwordDemo, rol: 'participante', estado: 'activo' });
  const fecha = horas => new Date(Date.now() + horas * 3600000).toISOString();
  const fechas = { inscripcionInicio: fecha(-1), inscripcionFin: fecha(144), inicio: fecha(168), fin: fecha(192), hackaton: { inscripcionInicio: fecha(-1), inscripcionFin: fecha(144), inicio: fecha(168), entregaInicio: fecha(174), entregaFin: fecha(192), evaluacionInicio: fecha(198), evaluacionFin: fecha(216), fin: fecha(240) } };
  const contexto = { base, apiUrl, sufijo, passwordDemo, actores: { administrador, organizador, participante }, fechas, integrantes, nacimientoDemo, institucionId: institucion.id, institucionNombre: institucion.nombre, institucionEliminarId: institucionEliminar.id, disciplinaId: disciplina.id, categoriaId: disciplina.categorias[0].id, usuarioNuevoId: cuentaNueva.id, preparadoEn: new Date().toISOString(), sesionesHasta: fecha(config.sessionHours) };
  const torneoAbierto = await crear('torneos', cuerpoTorneo(contexto, `Copa base Parcial ${sufijo}`), organizador);
  contexto.torneoAbiertoId = torneoAbierto.id;
  await ejecutar({ titulo: 'Abrir inscripciones del torneo base', metodo: 'PATCH', url: `${apiUrl}/torneos/${torneoAbierto.id}/estado`, headers: { 'Content-Type': 'application/json', Cookie: organizador.cookie, 'X-CSRF-Token': organizador.csrf }, cuerpo: { estado: 'inscripciones' }, estado: 200 });
  contexto.torneoReglasId = (await crear('torneos', cuerpoTorneo(contexto, `Borrador reglamento Parcial ${sufijo}`), organizador)).id;
  contexto.equipoBaseId = (await crear('equipos', cuerpoEquipo(contexto, `Equipo base Parcial ${sufijo}`), participante)).id;
  const solicitudes = crearSolicitudes(contexto);
  await mkdir(directorio, { recursive: true });
  await writeFile(`${directorio}/contexto.json`, JSON.stringify(contexto, null, 2));
  await writeFile(`${directorio}/solicitudes.json`, JSON.stringify(solicitudes, null, 2));
  await writeFile(`${directorio}/solicitudes.md`, guiaManual(contexto, solicitudes));
  await writeFile(`${directorio}/Campus_Parcial_2.import.json`, JSON.stringify(coleccionImportable(solicitudes), null, 2));
  console.log(`API de ensayo: ${apiUrl}`);
  console.log(`MongoDB: ${base}. La base de trabajo del proyecto se conserva.`);
  console.log('Peticiones: tmp/parcial-2/solicitudes.md');
  console.log('Importación opcional: tmp/parcial-2/Campus_Parcial_2.import.json');
  console.log('Prepara las 10 peticiones en Thunder Client y abre esta base en Compass.');
  if (process.argv.includes('--ensayar')) {
    const resultados = [];
    for (const peticion of [...solicitudes.principales, ...solicitudes.reserva]) {
      const resultado = await ejecutar(peticion);
      const persistencia = typeof peticion.numero === 'number' ? await comprobarPersistencia(contexto, peticion.numero) : undefined;
      resultados.push({ numero: peticion.numero, historia: peticion.historia?.id, metodo: peticion.metodo, estado: peticion.estado, duracionMs: resultado.duracionMs, ...(persistencia ? { persistencia } : {}) });
      console.log(`${String(peticion.numero).padStart(2, '0')} ${peticion.metodo} -> ${peticion.estado}: ${peticion.titulo}`);
    }
    const institucionActualizada = await Institution.findById(contexto.institucionId).lean();
    assert.equal(institucionActualizada.ciudad, 'Santiago de Cali');
    assert.equal(institucionActualizada.departamento, 'Valle del Cauca');
    await writeFile(`${directorio}/resultado-ensayo.json`, JSON.stringify({ fecha: new Date().toISOString(), base, peticiones: resultados, putPersistido: true }, null, 2));
    console.log('Ensayo técnico aprobado. Genera un conjunto nuevo antes de la exposición.');
    await cerrar();
  } else console.log('Mantén esta terminal abierta. Para terminar: Ctrl+C.');
}

async function verificar() {
  const contexto = JSON.parse(await readFile(`${directorio}/contexto.json`, 'utf8'));
  assert.equal(contexto.base, base, 'La base del contexto no coincide. Prepara de nuevo o usa la misma PARCIAL_DB_NAME.');
  const numero = process.argv[3] === undefined ? null : Number(process.argv[3]);
  if (numero !== null && (!Number.isInteger(numero) || numero < 1 || numero > 10)) throw new Error('Indica un paso entre 1 y 10.');
  const pasos = numero === null ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [numero];
  const resultados = [];
  for (const paso of pasos) resultados.push(await comprobarPersistencia(contexto, paso));
  console.table(resultados);
  await cerrar();
}

try {
  if (!['preparar', 'verificar'].includes(modo)) throw new Error('Usa npm run parcial:preparar o npm run parcial:verificar.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await initializeModels();
  if (modo === 'preparar') await preparar(); else await verificar();
} catch (error) {
  console.error(`No se pudo completar el ensayo: ${error.message}`);
  await cerrar();
  process.exitCode = 1;
}
