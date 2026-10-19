import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { uploaderMemoria } from '../../middlewares/upload.js';
import * as service from './soporte.service.js';

const router = Router();

const nueva = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  tipoSoporteId: z.coerce.number({ error: 'Seleccione el tipo de soporte' }).int().positive('Seleccione el tipo de soporte'),
  descripcion: z.string().trim().min(1, 'Describa la falla').max(1000, 'Máximo 1000 caracteres'),
});

router.post('/', uploaderMemoria().single('adjunto'), validate(nueva),
  asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body, req.file))));

export default router;
