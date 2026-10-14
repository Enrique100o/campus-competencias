import mongoose from 'mongoose';
import { readConfig } from './config.js';
import { initializeModels } from './models.js';
import { createApp } from './app.js';

const config = readConfig();
let server;
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await initializeModels();
  server = createApp(config).listen(config.port, config.host, () => {
    console.log(`API disponible en http://${config.host}:${config.port}`);
    console.log('MongoDB conectado y modelos inicializados.');
  });
  server.on('error', async () => {
    console.error(`No se pudo abrir el puerto ${config.port}. Revisa si ya hay otro servidor utilizándolo.`);
    await mongoose.disconnect();
    process.exit(1);
  });
} catch {
  console.error('No se pudo conectar con MongoDB. Comprueba que el servidor esté iniciado y revisa MONGODB_URI en backend/.env.');
  await mongoose.disconnect();
  process.exit(1);
}
