import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Permite mostrar imágenes que siguen en el IIS de la Intrapola actual
  contentSecurityPolicy: {
    directives: {
      'img-src': ["'self'", 'data:', 'blob:', env.legacyBaseUrl],
      'frame-src': ["'self'", 'blob:', 'https://www.google.com'], // blob: visor de la planilla de anticipos
      'upgrade-insecure-requests': null,
    },
  },
}));
app.use(cors({
  origin(origen, cb) {
    // Sin Origin = misma página o herramientas (curl, Postman): se permite
    if (!origen || env.corsOrigin.includes('*') || env.corsOrigin.includes(origen)) return cb(null, true);
    console.warn(`[cors] origen rechazado: ${origen} (agréguelo a CORS_ORIGIN en el .env)`);
    return cb(null, false);
  },
}));
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

/*
 * Todo cuelga de BASE_PATH (ej. /intrapola) para publicar la app en una subcarpeta:
 *   /intrapola/api, /intrapola/uploads y el frontend en /intrapola/
 * Debe coincidir con VITE_BASE del frontend. Sin BASE_PATH queda en la raíz.
 */
const basePath = `/${(process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');
const raiz = express.Router();

raiz.use('/uploads', express.static(path.resolve(env.uploadsDir), { maxAge: '7d', fallthrough: false }));
raiz.use('/api', routes);

// Opcional: servir el frontend compilado desde el mismo proceso (un solo puerto en el servidor)
const frontDist = process.env.FRONTEND_DIST && path.resolve(process.env.FRONTEND_DIST);
if (frontDist && fs.existsSync(frontDist)) {
  // index.html sin caché (cambia en cada build); los assets llevan hash y se pueden cachear
  raiz.use(express.static(frontDist, { index: false, maxAge: '30d', immutable: true }));
  raiz.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontDist, 'index.html'));
  });
}

if (basePath) app.get('/', (_req, res) => res.redirect(`${basePath}/`));
app.use(basePath || '/', raiz);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
