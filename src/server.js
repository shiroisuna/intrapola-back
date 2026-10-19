import app from './app.js';
import { env } from './config/env.js';
import { closePools } from './config/db.js';

const server = app.listen(env.port, () => {
  console.log(`[api] Intrapola escuchando en http://localhost:${env.port}/api`);
  console.log(`[cors] orígenes permitidos: ${env.corsOrigin.join(', ')}`);
});

const apagar = async (signal) => {
  console.log(`[api] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await closePools().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGINT', apagar);
// Para no perder de vista por qué se detiene la API (antes "terminaba" sin decir nada)
process.on('uncaughtException', (err) => { console.error('[api] error no controlado:', err); });
process.on('unhandledRejection', (err) => { console.error('[api] promesa rechazada sin controlar:', err); });
process.on('exit', (code) => { console.log(`[api] proceso terminado (código ${code})`); });
process.on('SIGTERM', apagar);
