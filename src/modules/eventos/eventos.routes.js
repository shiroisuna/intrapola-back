import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as ctrl from './eventos.controller.js';

const router = Router();

router.get('/', validate(z.object({ limite: z.coerce.number().int().min(1).max(100).default(30) }), 'query'), asyncHandler(ctrl.listar));

export default router;
