/**
 * PM2: pm2 start ecosystem.config.cjs
 * cwd = esta carpeta, para que se lea backend/.env (puerto, BASE_PATH, FRONTEND_DIST, bases de datos...).
 */
module.exports = {
  apps: [
    {
      name: 'intrapola-app',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,          // una sola instancia: las sesiones del portal de anticipos viven en memoria
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      out_file: 'logs/intrapola-out.log',
      error_file: 'logs/intrapola-error.log',
      time: true,
    },
  ],
};
