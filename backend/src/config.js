import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function readConfig(env = process.env) {
  const port = Number(env.PORT || 3001);
  const sessionHours = Number(env.SESSION_HOURS || 8);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
  if (!Number.isFinite(sessionHours) || sessionHours <= 0 || sessionHours > 72) {
    throw new Error('SESSION_HOURS debe estar entre 0 y 72 horas.');
  }
  const production = env.NODE_ENV === 'production';
  return {
    port,
    host: env.HOST || '127.0.0.1',
    mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/torneos_universidad',
    clientOrigin: new URL(env.CLIENT_ORIGIN || 'http://127.0.0.1:5173').origin,
    sessionHours,
    production,
    allowInitialSetup: !production && env.ALLOW_INITIAL_SETUP === 'true',
  };
}
