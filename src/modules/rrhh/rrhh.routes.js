import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as service from './rrhh.service.js';

const router = Router();

const nueva = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  tipoCodigo: z.string({ error: 'Seleccione qué necesita' }).regex(/^RRHH_[A-Z]+$/, 'Seleccione qué necesita'),
  descripcion: z.string().trim().min(1, 'Escriba su solicitud').max(500, 'Máximo 500 caracteres'),
});

router.post('/', validate(nueva), asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body))));

export default router;
