import mongoose from 'mongoose';
import { User, Institution } from './models.js';
import { Discipline, Tournament, Hackathon, Participant, Team, Registration, participationModes, competitionFormats } from './competition-models.js';
import { ApiError, formFields, normalize, text } from './validation.js';

let operationQueue = Promise.resolve();
export function competitionWrite(operation) {
  const result = operationQueue.then(operation);
  operationQueue = result.catch(() => {});
  return result;
}
export function id(value, field = 'referencia') {
  if (!mongoose.isObjectIdOrHexString(value)) throw new ApiError(400, `Revisa ${field}: identificador inválido.`);
  return String(value).toLowerCase();
}
export function integer(value, field, min, max) {
  if (!['number', 'string'].includes(typeof value) || value === '' || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new ApiError(400, `${field} debe ser un entero entre ${min} y ${max}.`);
  }
  return Number(value);
}
function choice(value, choices, field) {
  if (!choices.includes(value)) throw new ApiError(400, `Selecciona ${field} válido.`);
  return value;
}
function strings(values, field, minimum = 1, maximum = 30) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new ApiError(400, `Revisa ${field}.`);
  const result = values.map(value => text(value, field, 150, 1));
  if (new Set(result.map(normalize)).size !== result.length) throw new ApiError(400, `${field} contiene valores duplicados.`);
  return result;
}
function timestamp(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toISOString().slice(0, 10) !== value.slice(0, 10)) throw new ApiError(400, `Revisa la fecha de ${field}.`);
  return new Date(value);
}
function activeState(value = 'activo') { return choice(value, ['activo', 'inactivo'], 'un estado'); }
function optionalText(value, field, max = 2000) { return value === undefined || value === '' ? '' : text(value, field, max); }
export async function reference(Model, value, label, active = true) {
  const record = await Model.findById(id(value, label));
  if (!record) throw new ApiError(400, `${label} no existe.`, 'REFERENCE');
  if (active && record.estado !== 'activo') throw new ApiError(400, `${label} debe estar activo.`, 'INACTIVE_REFERENCE');
  return record;
}
export async function refreshActor(req) {
  const actor = await User.findById(req.user._id).select('+authVersion');
  if (!actor || actor.estado !== 'activo' || (actor.authVersion || 0) !== (req.session.authVersion || 0)) throw new ApiError(401, 'Inicia sesión para continuar.', 'UNAUTHENTICATED');
  req.user = actor;
  return actor;
}
export function requireRoles(user, roles) {
  if (!roles.includes(user.rol)) throw new ApiError(403, 'No tienes permiso para realizar esta operación.', 'FORBIDDEN');
}
export function managesEvent(user, event) { return user.rol === 'administrador' || (user.rol === 'organizador' && String(event.responsable) === String(user._id)); }
export function readableEvent(user, event) {
  if (event.estado === 'borrador' && !managesEvent(user, event)) throw new ApiError(403, 'Este evento aún no está publicado.', 'FORBIDDEN');
}
export function ownsRecord(user, record) { return user.rol === 'administrador' || String(record.creadoPor) === String(user._id) || String(record.responsable) === String(user._id); }

export async function disciplineInput(body, previous) {
  formFields(body, ['nombre', 'modalidades', 'formatos', 'categorias', 'estado']);
  const nombre = text(body.nombre, 'nombre', 100, 2);
  const modalidades = strings(body.modalidades, 'modalidades', 1, 3).map(value => choice(value, participationModes, 'una modalidad'));
  const formatos = strings(body.formatos, 'formatos', 1, 5).map(value => choice(value, competitionFormats, 'un formato'));
  if (!Array.isArray(body.categorias) || !body.categorias.length || body.categorias.length > 30) throw new ApiError(400, 'Agrega entre 1 y 30 categorías.');
  const categorias = body.categorias.map(category => {
    formFields(category, ['id', 'nombre', 'edadMin', 'edadMax', 'genero']);
    const edadMin = category.edadMin === null || category.edadMin === '' || category.edadMin === undefined ? null : integer(category.edadMin, 'Edad mínima', 0, 100);
    const edadMax = category.edadMax === null || category.edadMax === '' || category.edadMax === undefined ? null : integer(category.edadMax, 'Edad máxima', 0, 100);
    if (edadMin !== null && edadMax !== null && edadMin > edadMax) throw new ApiError(400, 'La edad mínima no puede superar la máxima.');
    const result = { nombre: text(category.nombre, 'categoría', 80, 2), edadMin, edadMax, genero: choice(category.genero || 'cualquiera', ['cualquiera', 'femenino', 'masculino'], 'un género de categoría') };
    if (category.id) {
      const categoryId = id(category.id, 'categoría');
      if (!previous?.categorias.some(item => String(item._id) === categoryId)) throw new ApiError(400, 'La categoría no pertenece a esta disciplina.');
      result._id = categoryId;
    }
    return result;
  });
  if (new Set(categorias.map(category => normalize(category.nombre))).size !== categorias.length) throw new ApiError(400, 'No repitas categorías dentro de la disciplina.');
  if (previous) {
    const [tournaments, teams] = await Promise.all([Tournament.find({ disciplina: previous._id }), Team.find({ disciplina: previous._id })]);
    for (const record of [...tournaments, ...teams]) {
      const old = previous.categorias.id(record.categoria);
      const next = categorias.find(item => String(item._id) === record.categoria);
      if (!next || !old || ['nombre', 'edadMin', 'edadMax', 'genero'].some(field => next[field] !== old[field])) throw new ApiError(409, 'No puedes cambiar o retirar una categoría que ya está en uso. Agrega otra categoría.');
      if (record.unidadInscripcion && !modalidades.includes(record.unidadInscripcion) || record.modalidad && !modalidades.includes(record.modalidad) || record.formato && !formatos.includes(record.formato)) throw new ApiError(409, 'No puedes retirar una modalidad o formato en uso.');
    }
  }
  return { nombre, clave: normalize(nombre), modalidades, formatos, categorias, estado: activeState(body.estado) };
}

function eventDates(body, hackathon = false) {
  const fields = ['inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', ...(hackathon ? ['entregaInicio', 'entregaFin', 'evaluacionInicio', 'evaluacionFin'] : [])];
  const result = Object.fromEntries(fields.map(field => [field, timestamp(body[field], field)]));
  if (result.inscripcionInicio > result.inscripcionFin || result.inscripcionFin > result.inicio || result.inicio > result.fin) throw new ApiError(400, 'Las inscripciones deben cerrar antes del inicio y la fecha final no puede ser anterior al inicio.');
  if (hackathon && (result.inicio > result.entregaInicio || result.entregaInicio > result.entregaFin || result.entregaFin > result.evaluacionInicio || result.evaluacionInicio > result.evaluacionFin || result.evaluacionFin > result.fin)) throw new ApiError(400, 'Ordena las ventanas de entrega y evaluación dentro de las fechas del hackatón.');
  return result;
}
async function eventOwner(body, user, previous) {
  const owner = await reference(User, body.responsable, 'El responsable', !previous || String(previous.responsable) !== body.responsable);
  requireRoles(owner, ['administrador', 'organizador']);
  if (user.rol === 'organizador' && String(owner._id) !== String(user._id)) throw new ApiError(403, 'Solo puedes gestionar los eventos asignados a tu cuenta.', 'FORBIDDEN');
  return owner._id;
}
function ruleInput(body, category, mode, format) {
  formFields(body, ['integrantesMin', 'integrantesMax', 'maxInscripciones', 'metrica', 'unidad', 'precision', 'orden', 'fases', 'avance', 'desempates', 'pruebas', 'requisitos', 'permiteMultiplesEquipos']);
  const integrantesMin = integer(body.integrantesMin, 'Integrantes mínimos', 1, 100);
  const integrantesMax = integer(body.integrantesMax, 'Integrantes máximos', integrantesMin, 100);
  if (mode === 'individual' && (integrantesMin !== 1 || integrantesMax !== 1)) throw new ApiError(400, 'Una inscripción individual debe tener un solo participante.');
  if (body.permiteMultiplesEquipos !== undefined && typeof body.permiteMultiplesEquipos !== 'boolean') throw new ApiError(400, 'Revisa la política de múltiples equipos.');
  const pruebas = strings(body.pruebas || [], 'pruebas', format === 'pruebas' ? 1 : 0);
  return {
    integrantesMin, integrantesMax, maxInscripciones: integer(body.maxInscripciones, 'Inscripciones por competidor', 1, 30),
    metrica: choice(body.metrica, ['goles', 'puntos', 'sets', 'tiempo', 'distancia', 'otra'], 'una métrica'), unidad: text(body.unidad, 'unidad', 40),
    precision: integer(body.precision, 'Decimales', 0, 6), orden: choice(body.orden, ['ascendente', 'descendente'], 'un orden'),
    fases: strings(body.fases, 'fases'), avance: text(body.avance, 'avance', 1000), desempates: strings(body.desempates, 'desempates'), pruebas,
    edadMin: category.edadMin, edadMax: category.edadMax, genero: category.genero,
    requisitos: optionalText(body.requisitos, 'requisitos'), permiteMultiplesEquipos: body.permiteMultiplesEquipos || false,
  };
}
export async function tournamentInput(body, user, previous) {
  formFields(body, ['nombre', 'descripcion', 'tipo', 'disciplina', 'categoria', 'unidadInscripcion', 'formato', 'ciudad', 'departamento', 'inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'cupos', 'responsable', 'reglamento']);
  const discipline = await reference(Discipline, body.disciplina, 'La disciplina', !previous || String(previous.disciplina) !== body.disciplina);
  const category = discipline.categorias.id(id(body.categoria, 'categoría'));
  if (!category) throw new ApiError(400, 'La categoría no pertenece a la disciplina.');
  const unidadInscripcion = choice(body.unidadInscripcion, discipline.modalidades, 'una modalidad de la disciplina');
  const formato = choice(body.formato, discipline.formatos, 'un formato de la disciplina');
  const reglamento = ruleInput(body.reglamento, category, unidadInscripcion, formato);
  const result = {
    nombre: text(body.nombre, 'nombre', 150, 2), descripcion: optionalText(body.descripcion, 'descripción'), tipo: choice(body.tipo, ['intercolegiados', 'universitario'], 'un tipo de torneo'),
    disciplina: discipline._id, categoria: String(category._id), categoriaNombre: category.nombre, unidadInscripcion, formato,
    ciudad: text(body.ciudad, 'ciudad', 100, 2), departamento: text(body.departamento, 'departamento', 100, 2), ...eventDates(body),
    cupos: integer(body.cupos, 'Cupos', 1, 10000), responsable: await eventOwner(body, user, previous), reglamento,
  };
  if (previous && previous.estado !== 'borrador') {
    if (String(previous.disciplina) !== String(result.disciplina) || previous.categoria !== result.categoria || previous.unidadInscripcion !== unidadInscripcion || previous.formato !== formato || Object.keys(reglamento).some(field => JSON.stringify(previous.reglamento[field]) !== JSON.stringify(reglamento[field]))) throw new ApiError(409, 'El reglamento y el formato quedan bloqueados al abrir inscripciones.', 'LOCKED_RULES');
    if (await Registration.countDocuments({ torneo: previous._id }) > result.cupos) throw new ApiError(409, 'Los cupos no pueden ser menores que las inscripciones confirmadas.');
  }
  return result;
}
export async function hackathonInput(body, user, previous) {
  formFields(body, ['nombre', 'descripcion', 'ciudad', 'departamento', 'modalidad', 'inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'entregaInicio', 'entregaFin', 'evaluacionInicio', 'evaluacionFin', 'cupos', 'integrantesMin', 'integrantesMax', 'proyectosPorEquipo', 'categorias', 'requisitos', 'responsable']);
  const integrantesMin = integer(body.integrantesMin, 'Integrantes mínimos', 1, 100);
  return {
    nombre: text(body.nombre, 'nombre', 150, 2), descripcion: text(body.descripcion, 'descripción', 2000), ciudad: text(body.ciudad, 'ciudad', 100, 2), departamento: text(body.departamento, 'departamento', 100, 2),
    modalidad: choice(body.modalidad, ['presencial', 'virtual', 'hibrida'], 'una modalidad'), ...eventDates(body, true), cupos: integer(body.cupos, 'Cupos de equipos', 1, 10000),
    integrantesMin, integrantesMax: integer(body.integrantesMax, 'Integrantes máximos', integrantesMin, 100), proyectosPorEquipo: integer(body.proyectosPorEquipo, 'Proyectos por equipo', 1, 10),
    categorias: strings(body.categorias, 'categorías'), requisitos: optionalText(body.requisitos, 'requisitos'), responsable: await eventOwner(body, user, previous),
  };
}
export async function participantInput(body, previous) {
  formFields(body, ['documento', 'nombre', 'nacimiento', 'genero', 'usuario', 'institucion', 'categoria', 'estado']);
  if (typeof body.nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.nacimiento)) throw new ApiError(400, 'Revisa la fecha de nacimiento.');
  const nacimiento = new Date(`${body.nacimiento}T00:00:00.000Z`);
  if (!Number.isFinite(nacimiento.getTime()) || nacimiento.toISOString().slice(0, 10) !== body.nacimiento || nacimiento > new Date() || nacimiento.getUTCFullYear() < 1900) throw new ApiError(400, 'La fecha de nacimiento no es válida.');
  const user = await reference(User, body.usuario, 'La cuenta del participante', !previous || String(previous.usuario) !== body.usuario);
  if (user.rol !== 'participante') throw new ApiError(400, 'Asocia una cuenta con rol de participante.');
  const institution = await reference(Institution, body.institucion, 'La institución', !previous || String(previous.institucion) !== body.institucion);
  return { documento: text(body.documento, 'documento', 30, 2).replace(/\s+/g, '').toUpperCase(), nombre: text(body.nombre, 'nombre', 100, 2), nacimiento, genero: choice(body.genero, ['femenino', 'masculino', 'otro'], 'un género'), usuario: user._id, institucion: institution._id, categoria: text(body.categoria, 'categoría de referencia', 80, 2), estado: activeState(body.estado) };
}
async function members(ids, active = true) {
  if (!Array.isArray(ids) || ids.length > 100) throw new ApiError(400, 'Revisa los integrantes del equipo.');
  const parsed = ids.map(value => id(value, 'integrante'));
  if (new Set(parsed).size !== parsed.length) throw new ApiError(400, 'No repitas integrantes en el equipo.');
  return Promise.all(parsed.map(value => reference(Participant, value, 'El participante', active)));
}
export function ageOn(birth, date) {
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (date.getUTCMonth() < birth.getUTCMonth() || date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate()) age--;
  return age;
}
async function eligible(participant, rules, date, institution) {
  const age = ageOn(participant.nacimiento, date);
  if (rules.edadMin !== null && age < rules.edadMin || rules.edadMax !== null && age > rules.edadMax) throw new ApiError(400, `${participant.nombre} no cumple la edad de la categoría.`, 'ELIGIBILITY');
  if (rules.genero !== 'cualquiera' && participant.genero !== rules.genero) throw new ApiError(400, `${participant.nombre} no cumple la categoría de género.`, 'ELIGIBILITY');
  if (institution && String(participant.institucion) !== String(institution)) throw new ApiError(400, 'Todos los integrantes deportivos deben pertenecer a la institución del equipo.', 'ELIGIBILITY');
  await reference(Institution, participant.institucion, 'La institución del participante');
  await reference(User, participant.usuario, 'La cuenta del participante');
}
export async function teamInput(body, user, previous) {
  formFields(body, ['nombre', 'tipo', 'responsable', 'estado', 'institucion', 'disciplina', 'categoria', 'modalidad', 'hackaton', 'categoriaTecnologica', 'integrantes']);
  const tipo = choice(body.tipo, ['deportivo', 'tecnologico'], 'un tipo de equipo');
  if (previous && tipo !== previous.tipo) throw new ApiError(409, 'El tipo de un equipo existente no se puede cambiar.');
  const owner = await reference(User, body.responsable, 'El responsable', !previous || String(previous.responsable) !== body.responsable);
  requireRoles(owner, ['administrador', 'organizador', 'participante']);
  if (user.rol === 'participante' && String(owner._id) !== String(user._id)) throw new ApiError(403, 'Solo puedes crear o gestionar tus equipos.', 'FORBIDDEN');
  if (!Array.isArray(body.integrantes || [])) throw new ApiError(400, 'Revisa los integrantes del equipo.');
  const sameRoster = previous && JSON.stringify(previous.integrantes.map(String).sort()) === JSON.stringify((body.integrantes || []).map(String).sort());
  const sameReferences = previous && ['institucion', 'disciplina', 'categoria', 'modalidad', 'hackaton', 'categoriaTecnologica'].every(key => String(previous[key] || '') === String(body[key] || ''));
  const validateEligibility = !sameRoster || !sameReferences;
  const people = await members(body.integrantes || [], validateEligibility);
  const data = { nombre: text(body.nombre, 'nombre', 120, 2), tipo, responsable: owner._id, estado: activeState(body.estado), integrantes: people.map(person => person._id) };
  if (tipo === 'deportivo') {
    const institution = await reference(Institution, body.institucion, 'La institución', !previous || String(previous.institucion) !== body.institucion);
    const discipline = await reference(Discipline, body.disciplina, 'La disciplina', !previous || String(previous.disciplina) !== body.disciplina);
    const category = discipline.categorias.id(id(body.categoria, 'categoría'));
    if (!category) throw new ApiError(400, 'La categoría no pertenece a la disciplina.');
    const modalidad = choice(body.modalidad, discipline.modalidades.filter(value => value !== 'individual'), 'una modalidad de equipo');
    if (validateEligibility) for (const person of people) await eligible(person, category, new Date(), institution._id);
    Object.assign(data, { institucion: institution._id, disciplina: discipline._id, categoria: String(category._id), categoriaNombre: category.nombre, modalidad });
  } else {
    if (body.disciplina || body.institucion || body.categoria || body.modalidad) throw new ApiError(400, 'Un equipo tecnológico utiliza los requisitos del hackatón.');
    const hackathon = await reference(Hackathon, body.hackaton, 'El hackatón de referencia', false);
    readableEvent(user, hackathon);
    if (validateEligibility && ['cancelado', 'publicado'].includes(hackathon.estado)) throw new ApiError(400, 'Este hackatón no admite nuevos equipos de referencia.');
    const categoriaTecnologica = choice(body.categoriaTecnologica, hackathon.categorias, 'una categoría del hackatón');
    if (people.length < hackathon.integrantesMin || people.length > hackathon.integrantesMax) throw new ApiError(400, 'El equipo debe cumplir el tamaño de plantilla del hackatón.');
    if (validateEligibility) for (const person of people) { await reference(User, person.usuario, 'La cuenta del integrante'); await reference(Institution, person.institucion, 'La institución del integrante'); }
    Object.assign(data, { hackaton: hackathon._id, categoriaTecnologica });
  }
  data.clave = [normalize(data.nombre), tipo, data.institucion || '', data.disciplina || '', data.categoria || '', data.hackaton || ''].join('|');
  if (previous && await Registration.exists({ competidor: previous._id })) {
    const rosterChanged = JSON.stringify(previous.integrantes.map(String).sort()) !== JSON.stringify(data.integrantes.map(String).sort());
    if (rosterChanged || String(previous.institucion || '') !== String(data.institucion || '') || String(previous.disciplina || '') !== String(data.disciplina || '') || previous.categoria !== data.categoria || previous.modalidad !== data.modalidad) throw new ApiError(409, 'La plantilla y las referencias quedan confirmadas al inscribir el equipo.', 'LOCKED_ROSTER');
  }
  return data;
}

export async function registerCompetitor(body, user) {
  formFields(body, ['torneo', 'modalidad', 'competidor', 'prueba']);
  requireRoles(user, ['administrador', 'organizador', 'participante']);
  const tournament = await reference(Tournament, body.torneo, 'El torneo', false);
  readableEvent(user, tournament);
  const now = new Date();
  if (tournament.estado !== 'inscripciones' || now < tournament.inscripcionInicio || now > tournament.inscripcionFin) throw new ApiError(409, 'El torneo no está dentro de su ventana de inscripción.', 'REGISTRATION_CLOSED');
  const modalidad = choice(body.modalidad, [tournament.unidadInscripcion], 'la modalidad del torneo');
  const prueba = body.prueba || '';
  if (tournament.reglamento.pruebas.length ? !tournament.reglamento.pruebas.includes(prueba) : prueba !== '') throw new ApiError(400, 'Selecciona una prueba válida del torneo.');
  await reference(Discipline, tournament.disciplina, 'La disciplina');
  let institution;
  let people;
  let competitor;
  if (modalidad === 'individual') {
    competitor = await reference(Participant, body.competidor, 'El participante');
    if (!managesEvent(user, tournament) && String(competitor.usuario) !== String(user._id)) throw new ApiError(403, 'No puedes inscribir a este participante en este torneo.', 'FORBIDDEN');
    institution = competitor.institucion;
    people = [competitor];
  } else {
    competitor = await reference(Team, body.competidor, 'El equipo');
    if (!managesEvent(user, tournament) && String(competitor.responsable) !== String(user._id)) throw new ApiError(403, 'No representas a este equipo ni gestionas este torneo.', 'FORBIDDEN');
    if (competitor.tipo !== 'deportivo' || String(competitor.disciplina) !== String(tournament.disciplina) || competitor.categoria !== tournament.categoria || competitor.modalidad !== modalidad) throw new ApiError(400, 'El equipo no corresponde a la disciplina, categoría o modalidad del torneo.', 'ELIGIBILITY');
    institution = competitor.institucion;
    people = await members(competitor.integrantes.map(String));
  }
  if (people.length < tournament.reglamento.integrantesMin || people.length > tournament.reglamento.integrantesMax) throw new ApiError(400, 'La plantilla no cumple el reglamento del torneo.', 'ELIGIBILITY');
  await reference(Institution, institution, 'La institución');
  for (const person of people) await eligible(person, tournament.reglamento, tournament.inicio, institution);
  const competitorId = competitor._id;
  if (await Registration.exists({ torneo: tournament._id, modalidad, competidor: competitorId, prueba })) throw new ApiError(409, 'El competidor ya está inscrito en esta prueba.', 'DUPLICATE_REGISTRATION');
  if (await Registration.countDocuments({ torneo: tournament._id, competidor: competitorId }) >= tournament.reglamento.maxInscripciones) throw new ApiError(409, 'El competidor alcanzó su límite de inscripciones.', 'REGISTRATION_LIMIT');
  if (!tournament.reglamento.permiteMultiplesEquipos && await Registration.exists({ torneo: tournament._id, competidor: { $ne: competitorId }, 'plantilla.participante': { $in: people.map(person => person._id) } })) throw new ApiError(409, 'Un integrante ya participa con otro equipo en este torneo.', 'MULTIPLE_TEAMS');
  if (await Registration.countDocuments({ torneo: tournament._id }) >= tournament.cupos) throw new ApiError(409, 'El torneo ya completó sus cupos.', 'FULL');
  return Registration.create({ torneo: tournament._id, modalidad, competidor: competitorId, institucion: institution, prueba, creadoPor: user._id, reglamentoVersion: tournament.reglamentoVersion, plantilla: people.map(person => ({ participante: person._id, nombre: person.nombre, institucion: person.institucion })) });
}
