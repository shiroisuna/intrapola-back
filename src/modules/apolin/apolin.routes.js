import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError, notFound } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as service from './apolin.service.js';
import * as repo from './apolin.repository.js';

/* Apolin (público): POST /api/apolin/inicio, POST /api/apolin/mensaje, GET /api/apolin/recordatorios/:id/imagen */
const router = Router();

// Freno simple por equipo: 60 mensajes por minuto (evita probar fichas en masa)
const usos = new Map();
function limitar(req, _res, next) {
  const ahora = Date.now();
  const lista = (usos.get(req.ip) ?? []).filter((t) => ahora - t < 60_000);
  lista.push(ahora);
  usos.set(req.ip, lista);
  if (lista.length > 60) return next(new HttpError(429, 'Demasiados mensajes seguidos. Espera un momento.'));
  next();
}

const conversacion = z.string().regex(/^[a-f0-9]{32}$/).optional();

router.post('/inicio', validate(z.object({ conversacion })),
  asyncHandler(async (req, res) => res.json(await service.inicio(req.body.conversacion))));

router.post('/mensaje', limitar, validate(z.object({ conversacion, texto: z.string().max(1000).default('') })),
  asyncHandler(async (req, res) => res.json(await service.mensaje(req.body, req.ip))));

router.get('/recordatorios/:id/imagen', validate(z.object({ id: z.coerce.number().int().positive() }), 'params'), asyncHandler(async (req, res) => {
  const img = await repo.imagenRecordatorio(req.params.id);
  if (!img?.imagen) throw notFound('Imagen no encontrada');
  const tipo = /^image\/(png|jpe?g|gif|webp)$/i.test(img.tipo || '') ? img.tipo : 'image/jpeg';
  res.set({ 'Content-Type': tipo, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
  res.send(img.imagen);
}));

// Préstamos vencidos: se revisan cada hora (antes se hacía en cada mensaje del chatbot)
setInterval(service.revisarPrestamosVencidos, 60 * 60_000).unref();
setTimeout(service.revisarPrestamosVencidos, 30_000).unref();

export default router;
