import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { requireSesion } from './anticipos.sesion.js';
import * as service from './anticipos.service.js';

const router = Router();

const cedula = z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida');
const clave = z.string().min(1, 'Escriba su clave').max(50, 'Máximo 50 caracteres');

router.get('/estado', (_req, res) => res.json(service.estado()));

router.get('/registro/:cedula', validate(z.object({ cedula }), 'params'),
  asyncHandler(async (req, res) => res.json(await service.datosRegistro(req.params.cedula))));

router.post('/registro', validate(z.object({
  cedula,
  clave: z.string().min(4, 'La clave debe tener al menos 4 caracteres').max(50, 'Máximo 50 caracteres'),
  correo: z.email('Correo inválido').max(150),
})), asyncHandler(async (req, res) => res.status(201).json(await service.registrar(req.body))));

router.post('/sesion', validate(z.object({ cedula, clave })),
  asyncHandler(async (req, res) => res.json(await service.ingresar(req.body))));

router.get('/panel', requireSesion, asyncHandler(async (req, res) => res.json(await service.panel(req.usuarioAnticipo))));

router.get('/planilla.pdf', requireSesion, asyncHandler(async (req, res) => {
  const pdf = await service.planillaPdf(req.usuarioAnticipo);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="planilla-prestaciones.pdf"', 'Cache-Control': 'no-store' });
  res.send(pdf);
}));

router.post('/', requireSesion, validate(z.object({
  monto: z.coerce.number({ error: 'Indique el monto' })
    .positive('El monto debe ser mayor que cero')
    .max(1e12, 'Monto inválido')
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Máximo dos decimales'),
})), asyncHandler(async (req, res) => res.status(201).json(await service.solicitar(req.usuarioAnticipo, req.body))));

export default router;
