import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Session, publicUser, roles, states } from './models.js';
import { ApiError, accountInput, accountPassword, emailAddress, escapedSearch, formFields, listPagination, text } from './validation.js';
import { hashPassword, verifyPassword, requireAdmin, requireCsrf } from './security.js';

// El servidor local procesa los cambios de cuenta en orden, incluso entre solicitudes simultáneas.
// Así, la comprobación del último administrador y su modificación forman una sola operación local.
let userWriteQueue = Promise.resolve();
function writeAccount(operation) {
  const result = userWriteQueue.then(operation);
  userWriteQueue = result.catch(() => {});
  return result;
}

async function currentActor(req, admin = false) {
  const user = await User.findById(req.user._id).select('+authVersion +passwordHash');
  if (!user || user.estado !== 'activo' || (user.authVersion || 0) !== (req.session.authVersion || 0)) {
    throw new ApiError(401, 'Inicia sesión para continuar.', 'UNAUTHENTICATED');
  }
  if (admin && user.rol !== 'administrador') throw new ApiError(403, 'Esta acción requiere permisos de administrador.', 'FORBIDDEN');
  return user;
}

function validId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new ApiError(400, 'Identificador de usuario inválido.');
}

export function usersRouter(authenticated) {
  const router = Router();
  router.use(authenticated);

  router.get('/', requireAdmin, async (req, res) => {
    const { page, limit } = listPagination(req.query);
    const search = escapedSearch(req.query.q);
    const filter = {};
    if (search) filter.$or = ['nombre', 'correo'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
    if (req.query.rol) {
      if (!roles.includes(req.query.rol)) throw new ApiError(400, 'Rol inválido.');
      filter.rol = req.query.rol;
    }
    if (req.query.estado) {
      if (!states.includes(req.query.estado)) throw new ApiError(400, 'Estado inválido.');
      filter.estado = req.query.estado;
    }
    const [items, total, all, active, admins] = await Promise.all([
      User.find(filter).sort({ nombre: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter), User.countDocuments({}),
      User.countDocuments({ estado: 'activo' }), User.countDocuments({ estado: 'activo', rol: 'administrador' }),
    ]);
    res.json({ data: { items: items.map(publicUser), total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: { total: all, active, admins } } });
  });

  router.post('/', requireAdmin, requireCsrf, async (req, res) => {
    const input = accountInput(req.body, true);
    const passwordHash = await hashPassword(input.password);
    const user = await writeAccount(async () => {
      await currentActor(req, true);
      return User.create({ nombre: input.nombre, correo: input.correo, rol: input.rol, estado: input.estado, passwordHash });
    });
    res.status(201).json({ data: publicUser(user) });
  });

  router.patch('/me', requireCsrf, async (req, res) => {
    const body = formFields(req.body, ['nombre', 'correo', 'currentPassword']);
    const user = await writeAccount(async () => {
      const current = await currentActor(req);
      const nombre = body.nombre === undefined ? current.nombre : text(body.nombre, 'nombre', 100, 2);
      const correo = body.correo === undefined ? current.correo : emailAddress(body.correo);
      if (correo !== current.correo) {
        if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128 || !await verifyPassword(body.currentPassword, current.passwordHash)) {
          throw new ApiError(400, 'Confirma tu contraseña actual para cambiar el correo.', 'PASSWORD_CONFIRMATION');
        }
      }
      current.nombre = nombre;
      current.correo = correo;
      await current.save();
      return current;
    });
    res.json({ data: publicUser(user) });
  });

  router.get('/:id', async (req, res) => {
    validId(req.params.id);
    if (req.user.rol !== 'administrador' && String(req.user._id) !== req.params.id.toLowerCase()) {
      throw new ApiError(403, 'No tienes permiso para consultar este perfil.', 'FORBIDDEN');
    }
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'Usuario no encontrado.', 'NOT_FOUND');
    res.json({ data: publicUser(user) });
  });

  router.patch('/:id', requireAdmin, requireCsrf, async (req, res) => {
    validId(req.params.id);
    const body = formFields(req.body, ['nombre', 'correo', 'rol', 'estado', 'password']);
    // Se calcula antes de entrar en la cola para mantener breves las operaciones serializadas.
    const passwordHash = body.password === undefined ? null : await hashPassword(accountPassword(body.password));
    const user = await writeAccount(async () => {
      const actor = await currentActor(req, true);
      const target = await User.findById(req.params.id).select('+authVersion');
      if (!target) throw new ApiError(404, 'Usuario no encontrado.', 'NOT_FOUND');
      const { id, ...previous } = publicUser(target);
      const input = accountInput({ ...previous, ...body });
      if (String(actor._id) === String(target._id) && input.estado !== 'activo') {
        throw new ApiError(409, 'No puedes desactivar tu propia cuenta.', 'SELF_DEACTIVATION');
      }
      if (target.rol === 'administrador' && target.estado === 'activo' && (input.rol !== 'administrador' || input.estado !== 'activo')) {
        const admins = await User.countDocuments({ rol: 'administrador', estado: 'activo' });
        if (admins <= 1) throw new ApiError(409, 'Debe permanecer al menos un administrador activo.', 'LAST_ADMIN');
      }
      const invalidateSessions = passwordHash !== null || target.estado !== input.estado;
      Object.assign(target, { nombre: input.nombre, correo: input.correo, rol: input.rol, estado: input.estado });
      if (passwordHash !== null) target.passwordHash = passwordHash;
      if (invalidateSessions) target.authVersion = (target.authVersion || 0) + 1;
      await target.save();
      if (invalidateSessions) await Session.deleteMany({ usuario: target._id });
      return target;
    });
    res.json({ data: publicUser(user) });
  });

  return router;
}
