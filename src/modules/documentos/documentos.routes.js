import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';
import { uploader } from '../../middlewares/upload.js';
import * as ctrl from './documentos.controller.js';

const router = Router();

const nuevoDoc = z.object({
  categoria: z.enum(['NORMA', 'FORMATO']),
  titulo: z.string().trim().min(3).max(150),
  descripcion: z.string().trim().max(300).optional().transform((v) => v || null),
  orden: z.coerce.number().int().min(0).default(0),
});

router.get('/normas', asyncHandler(ctrl.normas));
router.get('/formatos', asyncHandler(ctrl.formatos));
router.post('/', requireAdmin, uploader('documentos').single('archivo'), validate(nuevoDoc), asyncHandler(ctrl.crear));

export default router;
