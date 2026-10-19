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
      'frame-src': ["'self'", 'https://www.google.com'],
      'upgrade-insecure-requests': null,
    },
  },
}));
app.use(cors({ origin: env.corsOrigin }));
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/uploads', express.static(path.resolve(env.uploadsDir), { maxAge: '7d', fallthrough: false }));
app.use('/api', routes);

// Opcional: servir el frontend compilado desde el mismo proceso (un solo puerto en el servidor)
const frontDist = process.env.FRONTEND_DIST && path.resolve(process.env.FRONTEND_DIST);
if (frontDist && fs.existsSync(frontDist)) {
  app.use(express.static(frontDist, { maxAge: '1d', index: false }));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(frontDist, 'index.html')));
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
