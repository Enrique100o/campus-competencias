import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const developmentSecret = randomBytes(48).toString("base64url");

export function readConfig(env = process.env) {
  const port = Number(env.PORT || 3001);
  const sessionHours = Number(env.SESSION_HOURS || 8);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT inválido.");
  if (
    !Number.isFinite(sessionHours) ||
    sessionHours <= 0 ||
    sessionHours > 72
  ) {
    throw new Error("SESSION_HOURS debe estar entre 0 y 72 horas.");
  }
  const production = env.NODE_ENV === "production";
  const accessMinutes = Number(env.ACCESS_TOKEN_MINUTES || 15),
    refreshDays = Number(env.REFRESH_TOKEN_DAYS || 7);
  if (
    !Number.isFinite(accessMinutes) ||
    accessMinutes <= 0 ||
    accessMinutes > 60 ||
    !Number.isFinite(refreshDays) ||
    refreshDays <= 0 ||
    refreshDays > 30
  )
    throw new Error("Revisa la duración de access y refresh tokens.");
  if (production && (!env.JWT_SECRET || env.JWT_SECRET.length < 32))
    throw new Error(
      "Configura JWT_SECRET con al menos 32 caracteres en producción.",
    );
  return {
    port,
    host: env.HOST || "127.0.0.1",
    mongoUri:
      env.MONGODB_URI || "mongodb://127.0.0.1:27017/torneos_universidad",
    clientOrigin: new URL(env.CLIENT_ORIGIN || "http://127.0.0.1:5173").origin,
    sessionHours,
    production,
    jwtSecret: env.JWT_SECRET || developmentSecret,
    accessMinutes,
    refreshDays,
    allowInitialSetup: !production && env.ALLOW_INITIAL_SETUP === "true",
  };
}
