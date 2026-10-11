import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Session, User, publicUser } from './models.js';

const derive = promisify(scrypt);
export const COOKIE = 'campus_session';
const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded = dummyHash) {
  const [algorithm, salt, key] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(key || '')) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = await derive(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function cookieOptions(config) {
  return { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' };
}

export function readCookie(req) {
  const part = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`));
  if (!part) return null;
  try {
    const token = decodeURIComponent(part.slice(COOKIE.length + 1));
    return /^[\w-]{43}$/.test(token) ? token : null;
  } catch { return null; }
}

export async function createSession(res, user, config) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600000);
  await Session.create({ tokenHash: tokenHash(token), csrfToken, usuario: user._id, expiresAt, authVersion: user.authVersion || 0 });
  res.cookie(COOKIE, token, { ...cookieOptions(config), maxAge: config.sessionHours * 3600000 });
  return { user: publicUser(user), csrfToken };
}

export function requireSession(config) {
  return async (req, res, next) => {
    const token = readCookie(req);
    const session = token && await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    const user = session && await User.findById(session.usuario).select('+authVersion');
    if (!user || user.estado !== 'activo' || (session.authVersion || 0) !== (user.authVersion || 0)) {
      res.clearCookie(COOKIE, cookieOptions(config));
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar.' } });
    }
    req.user = user;
    req.session = session;
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Esta acción requiere permisos de administrador.' } });
  }
  next();
}

export function requireCsrf(req, res, next) {
  const supplied = Buffer.from(req.get('x-csrf-token') || '');
  const expected = Buffer.from(req.session.csrfToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(403).json({ error: { code: 'CSRF', message: 'La solicitud no es válida. Actualiza la página.' } });
  }
  next();
}

export function authLimiter() {
  const entries = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of entries) if (value.reset <= now) entries.delete(key);
    const key = req.ip;
    const entry = entries.get(key) || { count: 0, reset: now + 60000 };
    if (entry.count >= 10 || (!entries.has(key) && entries.size >= 5000)) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.' } });
    }
    entry.count += 1;
    entries.set(key, entry);
    next();
  };
}
