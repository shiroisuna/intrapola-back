import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { TIPOS_PERMISO, MEDIDAS } from './permisos.constantes.js';
import * as ctrl from './permisos.controller.js';

const router = Router();

const nuevoPermiso = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  fechaPermiso: z.coerce.date({ error: 'Fecha del permiso inválida' }),
  tipoPermiso: z.enum(TIPOS_PERMISO, { error: 'Seleccione el tipo de permiso' }),
  tiempo: z.coerce.number({ error: 'Indique el tiempo' }).int('El tiempo debe ser un número entero').min(1, 'Indique el tiempo').max(999),
  medida: z.enum(MEDIDAS, { error: 'Seleccione horas o días' }),
  motivo: z.string().trim().min(1, 'Indique el motivo del permiso').max(200, 'Máximo 200 caracteres'),
  observaciones: z.string().trim().max(500, 'Máximo 500 caracteres').optional().transform((v) => v || null),
});

const id = z.object({ id: z.coerce.number().int().positive() });

router.get('/opciones', (_req, res) => res.json({ tipos: TIPOS_PERMISO, medidas: MEDIDAS }));
router.post('/', validate(nuevoPermiso), asyncHandler(ctrl.crear));
router.get('/:id/pdf', validate(id, 'params'), asyncHandler(ctrl.pdf));

export default router;
