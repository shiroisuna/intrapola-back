import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as ctrl from './papeleria.controller.js';

const router = Router();

const nuevaSolicitud = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  items: z
    .array(z.object({
      articuloId: z.coerce.number().int().positive(),
      cantidad: z.coerce.number().int().min(1, 'La cantidad mínima es 1').max(999),
    }))
    .min(1, 'Agregue al menos un artículo')
    .max(50, 'Máximo 50 artículos por solicitud')
    .refine((arr) => new Set(arr.map((i) => i.articuloId)).size === arr.length, 'Hay artículos repetidos'),
  observaciones: z.string().trim().max(300, 'Máximo 300 caracteres').optional().transform((v) => v || null),
});

router.post('/', validate(nuevaSolicitud), asyncHandler(ctrl.crear));
router.get('/:numero/pdf', validate(z.object({ numero: z.coerce.number().int().positive() }), 'params'), asyncHandler(ctrl.pdf));

export default router;
