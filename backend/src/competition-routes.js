import { Router } from 'express';
import { User, Institution } from './models.js';
import { Discipline, Tournament, Hackathon, Participant, Team, Registration, resourceJSON, sportsStates, hackathonStates } from './competition-models.js';
import { ApiError, escapedSearch, formFields, listPagination } from './validation.js';
import { requireCsrf } from './security.js';
import { competitionWrite, disciplineInput, tournamentInput, hackathonInput, participantInput, teamInput, registerCompetitor, id, managesEvent, readableEvent, ownsRecord, refreshActor, requireRoles } from './competition-service.js';

const fields = {
  disciplinas: ['nombre', 'modalidades', 'formatos', 'categorias', 'estado'],
  torneos: ['nombre', 'descripcion', 'tipo', 'disciplina', 'categoria', 'unidadInscripcion', 'formato', 'ciudad', 'departamento', 'inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'cupos', 'responsable', 'reglamento'],
  hackatones: ['nombre', 'descripcion', 'ciudad', 'departamento', 'modalidad', 'inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'entregaInicio', 'entregaFin', 'evaluacionInicio', 'evaluacionFin', 'cupos', 'integrantesMin', 'integrantesMax', 'proyectosPorEquipo', 'categorias', 'requisitos', 'responsable'],
  participantes: ['documento', 'nombre', 'nacimiento', 'genero', 'usuario', 'institucion', 'categoria', 'estado'],
  equipos: ['nombre', 'tipo', 'responsable', 'estado', 'institucion', 'disciplina', 'categoria', 'modalidad', 'hackaton', 'categoriaTecnologica', 'integrantes'],
};
const ruleFields = ['integrantesMin', 'integrantesMax', 'maxInscripciones', 'metrica', 'unidad', 'precision', 'orden', 'fases', 'avance', 'desempates', 'pruebas', 'requisitos', 'permiteMultiplesEquipos'];
const models = { disciplinas: Discipline, torneos: Tournament, hackatones: Hackathon, participantes: Participant, equipos: Team };
const pick = (object, keys) => Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, object[key]]));
function previousInput(type, record) {
  const data = pick(resourceJSON(record), fields[type]);
  if (type === 'torneos') data.reglamento = pick(data.reglamento, ruleFields);
  if (type === 'participantes') data.nacimiento = data.nacimiento.slice(0, 10);
  return data;
}
async function validate(type, body, user, previous) {
  if (type === 'disciplinas') return disciplineInput(body, previous);
  if (type === 'torneos') return tournamentInput(body, user, previous);
  if (type === 'hackatones') return hackathonInput(body, user, previous);
  if (type === 'participantes') return participantInput(body, previous);
  return teamInput(body, user, previous);
}
function mayCreate(type, user) {
  if (['disciplinas', 'hackatones'].includes(type)) requireRoles(user, ['administrador']);
  else if (['torneos', 'participantes'].includes(type)) requireRoles(user, ['administrador', 'organizador']);
  else requireRoles(user, ['administrador', 'organizador', 'participante']);
}
function mayEdit(type, user, record) {
  if (type === 'disciplinas') requireRoles(user, ['administrador']);
  else if (['torneos', 'hackatones'].includes(type)) {
    if (!managesEvent(user, record)) throw new ApiError(403, 'No gestionas este evento.', 'FORBIDDEN');
    if (['finalizado', 'cancelado', 'publicado'].includes(record.estado)) throw new ApiError(409, 'El evento está cerrado y conserva su información.');
  } else {
    requireRoles(user, type === 'participantes' ? ['administrador', 'organizador'] : ['administrador', 'organizador', 'participante']);
    if (type === 'equipos' && user.rol === 'participante' && String(record.responsable) !== String(user._id)) throw new ApiError(403, 'No representas a este equipo.', 'FORBIDDEN');
    if (!ownsRecord(user, record)) throw new ApiError(403, 'No tienes permiso para modificar este registro.', 'FORBIDDEN');
  }
}
async function scope(type, user) {
  if (user.rol === 'administrador' || type === 'disciplinas') return {};
  if (['torneos', 'hackatones'].includes(type)) return { $or: [{ estado: { $ne: 'borrador' } }, { responsable: user._id }] };
  if (type === 'participantes') {
    requireRoles(user, ['organizador', 'participante']);
    return user.rol === 'participante' ? { usuario: user._id } : { creadoPor: user._id };
  }
  if (type === 'equipos') {
    requireRoles(user, ['organizador', 'participante']);
    return user.rol === 'participante' ? { responsable: user._id } : { $or: [{ creadoPor: user._id }, { responsable: user._id }] };
  }
  requireRoles(user, ['organizador', 'participante']);
  if (user.rol === 'organizador') return { torneo: { $in: await Tournament.find({ responsable: user._id }).distinct('_id') } };
  const participantIds = await Participant.find({ usuario: user._id }).distinct('_id');
  const teams = await Team.find({ $or: [{ responsable: user._id }, { integrantes: { $in: participantIds } }] }).distinct('_id');
  return { competidor: { $in: [...participantIds, ...teams] } };
}
async function label(Model, value) { if (!value) return ''; return (await Model.findById(value).select('nombre'))?.nombre || 'Registro no disponible'; }
async function enriched(type, record) {
  const data = resourceJSON(record);
  const names = await Promise.all([
    label(Institution, record.institucion), label(Discipline, record.disciplina), label(User, record.responsable), label(User, record.usuario), label(Hackathon, record.hackaton),
  ]);
  [data.institucionNombre, data.disciplinaNombre, data.responsableNombre, data.usuarioNombre, data.hackatonNombre] = names;
  if (type === 'torneos') data.inscritos = await Registration.countDocuments({ torneo: record._id });
  return data;
}

export function competitionRouter(authenticated) {
  const router = Router();
  router.use(authenticated);

  router.get('/catalogos', async (req, res) => {
    const management = ['administrador', 'organizador'].includes(req.user.rol);
    const [instituciones, disciplinas, usuarios, participantes, equipos, hackatones, torneos] = await Promise.all([
      Institution.find({}).select('nombre estado ciudad').sort({ nombre: 1 }).limit(500).lean(),
      Discipline.find({}).sort({ nombre: 1 }).limit(500).lean(),
      User.find(management ? {} : { _id: req.user._id }).select('nombre rol estado').sort({ nombre: 1 }).limit(500).lean(),
      req.user.rol === 'jurado' ? [] : Participant.find({}).select('nombre institucion categoria estado usuario').sort({ nombre: 1 }).limit(500).lean(),
      req.user.rol === 'jurado' ? [] : Team.find({}).select('nombre tipo estado responsable disciplina categoria modalidad institucion integrantes').sort({ nombre: 1 }).limit(500).lean(),
      Hackathon.find(await scope('hackatones', req.user)).sort({ nombre: 1 }).limit(500).lean(),
      Tournament.find(await scope('torneos', req.user)).sort({ nombre: 1 }).limit(500).lean(),
    ]);
    res.json({ data: resourceJSON({ instituciones, disciplinas, usuarios, participantes, equipos, hackatones, torneos }) });
  });

  for (const [type, Model] of Object.entries(models)) {
    router.get(`/${type}`, async (req, res) => {
      const base = await scope(type, req.user);
      const filters = [];
      const search = escapedSearch(req.query.q);
      if (search) filters.push({ $or: ['nombre', ...(type === 'participantes' ? ['documento', 'categoria'] : ['descripcion'])].map(field => ({ [field]: { $regex: search, $options: 'i' } })) });
      if (req.query.estado) {
        const allowed = type === 'torneos' ? sportsStates : type === 'hackatones' ? hackathonStates : ['activo', 'inactivo'];
        if (!allowed.includes(req.query.estado)) throw new ApiError(400, 'Estado inválido.');
        filters.push({ estado: req.query.estado });
      }
      if (req.query.tipo) {
        const allowed = type === 'torneos' ? ['intercolegiados', 'universitario'] : type === 'equipos' ? ['deportivo', 'tecnologico'] : [];
        if (!allowed.includes(req.query.tipo)) throw new ApiError(400, 'Tipo inválido.');
        filters.push({ tipo: req.query.tipo });
      }
      for (const field of ['disciplina', 'institucion', 'responsable']) if (req.query[field]) filters.push({ [field]: id(req.query[field], field) });
      if (req.query.categoria) {
        if (typeof req.query.categoria !== 'string' || req.query.categoria.length > 80) throw new ApiError(400, 'Categoría inválida.');
        filters.push({ [type === 'hackatones' ? 'categorias' : 'categoria']: req.query.categoria });
      }
      const filter = { $and: [base, ...filters] };
      const { page, limit } = listPagination(req.query);
      const [items, total, all, active] = await Promise.all([
        Model.find(filter).sort({ nombre: 1, _id: 1 }).skip((page - 1) * limit).limit(limit), Model.countDocuments(filter), Model.countDocuments(base),
        Model.countDocuments({ $and: [base, { estado: ['torneos', 'hackatones'].includes(type) ? 'inscripciones' : 'activo' }] }),
      ]);
      res.json({ data: { items: await Promise.all(items.map(item => enriched(type, item))), total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: { total: all, active } } });
    });

    router.get(`/${type}/:id`, async (req, res) => {
      const record = await Model.findOne({ $and: [{ _id: id(req.params.id) }, await scope(type, req.user)] });
      if (!record) throw new ApiError(404, 'Registro no encontrado o no autorizado.', 'NOT_FOUND');
      res.json({ data: await enriched(type, record) });
    });

    router.post(`/${type}`, requireCsrf, async (req, res) => {
      mayCreate(type, req.user);
      const record = await competitionWrite(async () => {
        await refreshActor(req);
        mayCreate(type, req.user);
        const input = await validate(type, req.body, req.user);
        return Model.create({ ...input, ...(['torneos', 'hackatones', 'participantes', 'equipos'].includes(type) ? { creadoPor: req.user._id } : {}) });
      });
      res.status(201).json({ data: await enriched(type, record) });
    });

    router.patch(`/${type}/:id`, requireCsrf, async (req, res) => {
      const record = await competitionWrite(async () => {
        await refreshActor(req);
        const previous = await Model.findById(id(req.params.id));
        if (!previous) throw new ApiError(404, 'Registro no encontrado.', 'NOT_FOUND');
        mayEdit(type, req.user, previous);
        formFields(req.body, fields[type]);
        const input = await validate(type, { ...previousInput(type, previous), ...req.body }, req.user, previous);
        if (type === 'torneos' && previous.estado === 'borrador') previous.reglamentoVersion += 1;
        Object.assign(previous, input);
        await previous.save();
        return previous;
      });
      res.json({ data: await enriched(type, record) });
    });
  }

  for (const [type, Model] of [['torneos', Tournament], ['hackatones', Hackathon]]) {
    router.patch(`/${type}/:id/estado`, requireCsrf, async (req, res) => {
      formFields(req.body, ['estado']);
      const record = await competitionWrite(async () => {
        await refreshActor(req);
        const event = await Model.findById(id(req.params.id));
        if (!event) throw new ApiError(404, 'Evento no encontrado.', 'NOT_FOUND');
        if (!managesEvent(req.user, event)) throw new ApiError(403, 'No gestionas este evento.', 'FORBIDDEN');
        if (event.estado !== 'borrador' || req.body.estado !== 'inscripciones') throw new ApiError(409, 'La transición disponible en esta entrega es abrir inscripciones desde borrador.');
        await validate(type, previousInput(type, event), req.user, event);
        if (type === 'torneos') await Discipline.findOne({ _id: event.disciplina, estado: 'activo' }).orFail(() => new ApiError(400, 'Activa la disciplina antes de publicar el torneo.'));
        event.estado = 'inscripciones';
        await event.save();
        return event;
      });
      res.json({ data: await enriched(type, record) });
    });
  }

  router.get('/inscripciones', async (req, res) => {
    const base = await scope('inscripciones', req.user);
    const filter = { $and: [base, ...(req.query.torneo ? [{ torneo: id(req.query.torneo, 'torneo') }] : [])] };
    const { page, limit } = listPagination(req.query);
    const [items, total] = await Promise.all([Registration.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit), Registration.countDocuments(filter)]);
    const result = await Promise.all(items.map(async record => {
      const data = resourceJSON(record);
      data.torneoNombre = await label(Tournament, record.torneo);
      data.competidorNombre = await label(record.modalidad === 'individual' ? Participant : Team, record.competidor);
      data.institucionNombre = await label(Institution, record.institucion);
      return data;
    }));
    res.json({ data: { items: result, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: { total, active: total } } });
  });
  router.post('/inscripciones', requireCsrf, async (req, res) => {
    const record = await competitionWrite(async () => { await refreshActor(req); return registerCompetitor(req.body, req.user); });
    res.status(201).json({ data: resourceJSON(record) });
  });

  return router;
}
