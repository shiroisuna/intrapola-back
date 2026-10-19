import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import * as ctrl from './precios.controller.js';

const router = Router();

router.get('/', asyncHandler(ctrl.vigentes));

export default router;
