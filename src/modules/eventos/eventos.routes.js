import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as ctrl from './eventos.controller.js';
import * as service from './eventos.service.js';

const router = Router();

router.get('/', validate(z.object({ limite: z.coerce.number().int().min(1).max(100).default(30) }), 'query'), asyncHandler(ctrl.listar));
// Galería de un evento creado en el panel
router.get('/:id', validate(z.object({ id: z.coerce.number().int().positive() }), 'params'),
  asyncHandler(async (req, res) => res.json(await service.galeria(req.params.id))));

export default router;
