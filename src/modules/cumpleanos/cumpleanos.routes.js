import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as ctrl from './cumpleanos.controller.js';

const router = Router();

router.get('/', validate(z.object({ mes: z.coerce.number().int().min(1).max(12).optional() }), 'query'), asyncHandler(ctrl.delMes));

export default router;
