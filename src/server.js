import app from './app.js';
import { env } from './config/env.js';
import { closePools } from './config/db.js';

const server = app.listen(env.port, () => {
  console.log(`[api] Intrapola escuchando en http://localhost:${env.port}/api`);
});

const apagar = async (signal) => {
  console.log(`[api] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await closePools().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
