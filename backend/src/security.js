import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Session, User, publicUser } from "./models.js";
import jwt from "jsonwebtoken";
import { RefreshToken } from "./modules/auth/models.js";

const derive = promisify(scrypt);
export const COOKIE = "campus_session";
export const REFRESH_COOKIE = "campus_refresh";
const dummyHash = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password, encoded = dummyHash) {
  const [algorithm, salt, key] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !/^[a-f0-9]{128}$/.test(key || ""))
    return false;
  const expected = Buffer.from(key, "hex");
  const actual = await derive(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
  };
}

export function readCookie(req) {
  const part = req.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE}=`));
  if (!part) return null;
  try {
    const token = decodeURIComponent(part.slice(COOKIE.length + 1));
    return /^[\w-]{43}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export async function createSession(
  res,
  user,
  config,
  family = randomBytes(24).toString("hex"),
  refreshExpiry,
) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600000);
  const session = await Session.create({
    tokenHash: tokenHash(token),
    csrfToken,
    usuario: user._id,
    expiresAt,
    authVersion: user.authVersion || 0,
    familia: family,
  });
  res.cookie(COOKIE, token, {
    ...cookieOptions(config),
    maxAge: config.sessionHours * 3600000,
  });
  const refresh = randomBytes(32).toString("base64url");
  const refreshExpiresAt =
    refreshExpiry ||
    new Date(Date.now() + (config.refreshDays || 7) * 86400000);
  await RefreshToken.create({
    tokenHash: tokenHash(refresh),
    familia: family,
    usuario: user._id,
    sesion: session._id,
    authVersion: user.authVersion || 0,
    expiresAt: refreshExpiresAt,
  });
  res.cookie(REFRESH_COOKIE, refresh, {
    ...cookieOptions(config),
    path: "/api/auth",
    maxAge: +refreshExpiresAt - Date.now(),
  });
  return sessionData(user, session, config);
}

export function sessionData(user, session, config) {
  const accessToken = jwt.sign(
    { sid: String(session._id), ver: user.authVersion || 0 },
    config.jwtSecret,
    {
      algorithm: "HS256",
      subject: String(user._id),
      issuer: "campus-api",
      audience: "campus-web",
      expiresIn: (config.accessMinutes || 15) * 60,
    },
  );
  return {
    user: publicUser(user),
    csrfToken: session.csrfToken,
    accessToken,
    expiresIn: (config.accessMinutes || 15) * 60,
  };
}

export function requireSession(config) {
  return async (req, res, next) => {
    let session;
    const bearer = req.get("authorization");
    if (bearer) {
      try {
        if (!bearer.startsWith("Bearer "))
          throw new Error("Formato de autorización inválido.");
        const claims = jwt.verify(bearer.slice(7), config.jwtSecret, {
          algorithms: ["HS256"],
          issuer: "campus-api",
          audience: "campus-web",
        });
        if (!/^[a-f\d]{24}$/i.test(claims.sid || ""))
          throw new Error("Sesión inválida.");
        session = await Session.findOne({
          _id: claims.sid,
          usuario: claims.sub,
          expiresAt: { $gt: new Date() },
          authVersion: claims.ver,
        });
      } catch {
        return res.status(401).json({
          error: {
            code: "ACCESS_EXPIRED",
            message: "Renueva la sesión para continuar.",
          },
        });
      }
    } else {
      const token = readCookie(req);
      session =
        token &&
        (await Session.findOne({
          tokenHash: tokenHash(token),
          expiresAt: { $gt: new Date() },
        }));
    }
    const user =
      session && (await User.findById(session.usuario).select("+authVersion"));
    if (
      !user ||
      user.estado !== "activo" ||
      (session.authVersion || 0) !== (user.authVersion || 0)
    ) {
      res.clearCookie(COOKIE, cookieOptions(config));
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Inicia sesión para continuar.",
        },
      });
    }
    req.user = user;
    req.session = session;
    next();
  };
}

export async function refreshSession(req, res, config) {
  // JSON + SameSite + validación de Origin del servidor bloquean formularios CSRF sobre /refresh.
  if (!req.is("application/json"))
    return res.status(403).json({
      error: {
        code: "CSRF",
        message: "La renovación requiere JSON desde la aplicación.",
      },
    });
  const encoded = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${REFRESH_COOKIE}=`))
    ?.slice(REFRESH_COOKIE.length + 1);
  if (!encoded || !/^[\w-]{43}$/.test(encoded))
    return res.status(401).json({
      error: {
        code: "REFRESH_INVALID",
        message: "Inicia sesión nuevamente.",
      },
    });
  const hash = tokenHash(encoded),
    now = new Date();
  // Una sola solicitud puede consumir el token, incluso con solicitudes concurrentes.
  const current = await RefreshToken.findOneAndUpdate(
    {
      tokenHash: hash,
      usadoEn: null,
      revocadoEn: null,
      expiresAt: { $gt: now },
    },
    { $set: { usadoEn: now } },
    { returnDocument: "before" },
  );
  if (!current) {
    const reused = await RefreshToken.findOne({ tokenHash: hash });
    if (reused) {
      await RefreshToken.updateMany(
        { familia: reused.familia },
        { $set: { revocadoEn: now } },
      );
      await Session.deleteMany({ familia: reused.familia });
    }
    res.clearCookie(REFRESH_COOKIE, {
      ...cookieOptions(config),
      path: "/api/auth",
    });
    return res.status(401).json({
      error: {
        code: "REFRESH_REUSED",
        message: "La sesión venció o se reutilizó. Inicia sesión nuevamente.",
      },
    });
  }
  const user = await User.findById(current.usuario).select("+authVersion");
  if (
    !user ||
    user.estado !== "activo" ||
    (user.authVersion || 0) !== current.authVersion
  )
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Inicia sesión nuevamente.",
      },
    });
  await Session.deleteOne({ _id: current.sesion });
  const data = await createSession(
    res,
    user,
    config,
    current.familia,
    current.expiresAt,
  );
  // Si se detectó una reutilización mientras se emitía el nuevo par, tampoco se deja viva la sesión nueva.
  if (
    await RefreshToken.exists({
      familia: current.familia,
      revocadoEn: { $ne: null },
    })
  ) {
    await RefreshToken.updateMany(
      { familia: current.familia },
      { $set: { revocadoEn: new Date() } },
    );
    await Session.deleteMany({ familia: current.familia });
    return res.status(401).json({
      error: { code: "REFRESH_REUSED", message: "Inicia sesión nuevamente." },
    });
  }
  return res.json({ data });
}

export async function revokeSession(req, res, config) {
  if (req.session.familia)
    await RefreshToken.updateMany(
      { familia: req.session.familia },
      { $set: { revocadoEn: new Date() } },
    );
  await req.session.deleteOne();
  res.clearCookie(COOKIE, cookieOptions(config));
  res.clearCookie(REFRESH_COOKIE, {
    ...cookieOptions(config),
    path: "/api/auth",
  });
  res.json({ data: { message: "Sesión cerrada." } });
}

export function requireAdmin(req, res, next) {
  if (req.user.rol !== "administrador") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Esta acción requiere permisos de administrador.",
      },
    });
  }
  next();
}

export function requireCsrf(req, res, next) {
  const supplied = Buffer.from(req.get("x-csrf-token") || "");
  const expected = Buffer.from(req.session.csrfToken);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return res.status(403).json({
      error: {
        code: "CSRF",
        message: "La solicitud no es válida. Actualiza la página.",
      },
    });
  }
  next();
}

export function authLimiter() {
  const entries = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of entries)
      if (value.reset <= now) entries.delete(key);
    const key = req.ip;
    const entry = entries.get(key) || { count: 0, reset: now + 60000 };
    if (entry.count >= 10 || (!entries.has(key) && entries.size >= 5000)) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({
        error: {
          code: "RATE_LIMIT",
          message:
            "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
        },
      });
    }
    entry.count += 1;
    entries.set(key, entry);
    next();
  };
}
