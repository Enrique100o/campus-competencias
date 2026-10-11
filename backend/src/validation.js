import { institutionTypes, roles, states } from './models.js';

export class ApiError extends Error {
  constructor(status, message, code = 'VALIDATION', fields) {
    super(message);
    Object.assign(this, { status, code, fields });
  }
}

export function text(value, field, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new ApiError(400, `Revisa el campo ${field}.`, 'VALIDATION', { [field]: `Debe contener entre ${min} y ${max} caracteres.` });
  }
  return value.trim();
}

export function credentials(body, setup = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Envía los datos del formulario.');
  const correo = emailAddress(body.correo);
  if (typeof body.password !== 'string' || body.password.length > 128 || body.password.length < (setup ? 10 : 1)) {
    throw new ApiError(400, setup ? 'La contraseña debe tener entre 10 y 128 caracteres.' : 'Ingresa tu contraseña.', 'VALIDATION', { password: 'Contraseña inválida.' });
  }
  return { correo, password: body.password, ...(setup ? { nombre: text(body.nombre, 'nombre', 100, 2) } : {}) };
}

export function emailAddress(value) {
  const correo = text(value, 'correo', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new ApiError(400, 'Ingresa un correo válido.', 'VALIDATION', { correo: 'Correo inválido.' });
  return correo;
}

export function formFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Envía los datos del formulario.');
  if (Object.keys(body).some(field => !allowed.includes(field))) {
    throw new ApiError(400, 'El formulario contiene campos que no puedes modificar.', 'FORBIDDEN_FIELDS');
  }
  return body;
}

export function accountInput(body, creating = false) {
  formFields(body, ['nombre', 'correo', 'rol', 'estado', 'password']);
  const data = { nombre: text(body.nombre, 'nombre', 100, 2), correo: emailAddress(body.correo), rol: body.rol, estado: body.estado };
  if (!roles.includes(data.rol)) throw new ApiError(400, 'Selecciona un rol válido.');
  if (!states.includes(data.estado)) throw new ApiError(400, 'Selecciona un estado válido.');
  if (creating || body.password !== undefined) {
    data.password = accountPassword(body.password);
  }
  return data;
}

export function accountPassword(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
    throw new ApiError(400, 'La contraseña debe tener entre 10 y 128 caracteres.');
  }
  return value;
}

export function listPagination(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  if (!Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError(400, 'La paginación no es válida.');
  }
  return { page, limit };
}

export function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function institutionInput(body) {
  const data = {
    nombre: text(body?.nombre, 'nombre', 150, 2),
    ciudad: text(body?.ciudad, 'ciudad', 100, 2),
    departamento: text(body?.departamento, 'departamento', 100, 2),
    tipo: body.tipo,
    estado: body.estado || 'activo',
  };
  if (!institutionTypes.includes(data.tipo)) throw new ApiError(400, 'Selecciona un tipo de institución válido.');
  if (!states.includes(data.estado)) throw new ApiError(400, 'Selecciona un estado válido.');
  data.clave = [data.nombre, data.ciudad, data.departamento].map(normalize).join('|');
  return data;
}

export function escapedSearch(value = '') {
  if (typeof value !== 'string' || value.length > 100) throw new ApiError(400, 'La búsqueda es demasiado larga.');
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
