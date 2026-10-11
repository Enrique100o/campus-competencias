import express from 'express';
import mongoose from 'mongoose';
import { User, Institution, publicUser, publicInstitution, states } from './models.js';
import { ApiError, credentials, institutionInput, escapedSearch } from './validation.js';
import { COOKIE, authLimiter, cookieOptions, createSession, hashPassword, verifyPassword, requireSession, requireAdmin, requireCsrf } from './security.js';
import { usersRouter } from './users.js';
import { competitionRouter } from './competition-routes.js';

export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== config.clientOrigin) {
      throw new ApiError(403, 'El origen de la solicitud no está autorizado.', 'ORIGIN');
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  const authenticated = requireSession(config);
  const limiter = authLimiter();

  app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ data: { status: connected ? 'ok' : 'unavailable', database: connected } });
  });

  app.get('/api/setup/status', async (req, res) => {
    const exists = await User.exists({});
    res.json({ data: { needsSetup: !exists && config.allowInitialSetup, setupAllowed: config.allowInitialSetup } });
  });

  app.post('/api/setup/administrador', limiter, async (req, res) => {
    if (!config.allowInitialSetup) throw new ApiError(404, 'Operación no disponible.', 'NOT_FOUND');
    if (await User.exists({})) throw new ApiError(409, 'La cuenta inicial ya fue creada. Inicia sesión.', 'SETUP_CLOSED');
    const input = credentials(req.body, true);
    const user = await User.create({
      nombre: input.nombre, correo: input.correo,
      passwordHash: await hashPassword(input.password),
      rol: 'administrador', estado: 'activo', bootstrapAdmin: true,
    });
    res.status(201).json({ data: await createSession(res, user, config) });
  });

  app.post('/api/auth/login', limiter, async (req, res) => {
    const input = credentials(req.body);
    const user = await User.findOne({ correo: input.correo }).select('+passwordHash +authVersion');
    const valid = await verifyPassword(input.password, user?.passwordHash);
    if (!valid || user?.estado !== 'activo') throw new ApiError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
    res.json({ data: await createSession(res, user, config) });
  });

  app.get('/api/auth/me', authenticated, (req, res) => {
    res.json({ data: { user: publicUser(req.user), csrfToken: req.session.csrfToken } });
  });

  app.post('/api/auth/logout', authenticated, requireCsrf, async (req, res) => {
    await req.session.deleteOne();
    res.clearCookie(COOKIE, cookieOptions(config));
    res.json({ data: { message: 'Sesión cerrada.' } });
  });

  app.use('/api/usuarios', usersRouter(authenticated));
  app.use('/api', competitionRouter(authenticated));

  app.get('/api/instituciones', authenticated, async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    if (!Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new ApiError(400, 'La paginación no es válida.');
    }
    const search = escapedSearch(req.query.q);
    const filter = {};
    if (search) filter.$or = ['nombre', 'ciudad', 'departamento'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
    if (req.query.estado) {
      if (!states.includes(req.query.estado)) throw new ApiError(400, 'Estado inválido.');
      filter.estado = req.query.estado;
    }
    const [items, total, all, active, cities] = await Promise.all([
      Institution.find(filter).sort({ nombre: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Institution.countDocuments(filter), Institution.countDocuments({}),
      Institution.countDocuments({ estado: 'activo' }), Institution.distinct('ciudad'),
    ]);
    res.json({ data: { items: items.map(publicInstitution), total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: { total: all, active, cities: cities.length } } });
  });

  app.post('/api/instituciones', authenticated, requireAdmin, requireCsrf, async (req, res) => {
    const institution = await Institution.create(institutionInput(req.body));
    res.status(201).json({ data: publicInstitution(institution) });
  });

  app.patch('/api/instituciones/:id', authenticated, requireAdmin, requireCsrf, async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new ApiError(400, 'Identificador de institución inválido.');
    const institution = await Institution.findById(req.params.id);
    if (!institution) throw new ApiError(404, 'Institución no encontrada.', 'NOT_FOUND');
    Object.assign(institution, institutionInput({ ...publicInstitution(institution), ...req.body }));
    await institution.save();
    res.json({ data: publicInstitution(institution) });
  });

  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 11000) {
      let message = 'Ya existe una institución con ese nombre y ubicación.';
      if (req.path.startsWith('/api/setup')) message = 'La cuenta inicial ya existe. Inicia sesión.';
      else if (req.path.startsWith('/api/usuarios')) message = 'Ya existe una cuenta con ese correo.';
      else if (req.path.startsWith('/api/disciplinas')) message = 'Ya existe una disciplina con ese nombre.';
      else if (req.path.startsWith('/api/participantes')) message = 'Ya existe un participante con ese documento o cuenta.';
      else if (req.path.startsWith('/api/equipos')) message = 'Ya existe un equipo con ese nombre en esta categoría.';
      else if (req.path.startsWith('/api/inscripciones')) message = 'Este competidor ya está inscrito en la prueba.';
      return res.status(409).json({ error: { code: 'DUPLICATE', message } });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El formato enviado no es válido.' } });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'La solicitud es demasiado grande.' } });
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Revisa los datos enviados.' } });
    }
    const status = error.status || 500;
    if (status >= 500) console.error('La API no pudo completar una operación:', error.name);
    res.status(status).json({ error: { code: error.code || 'INTERNAL', message: status < 500 ? error.message : 'No se pudo completar la operación. Intenta nuevamente.', ...(error.fields ? { fields: error.fields } : {}) } });
  });
  return app;
}
