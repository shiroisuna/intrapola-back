import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import * as ctrl from './directorio.controller.js';

const router = Router();

router.get('/extensiones', asyncHandler(ctrl.extensiones));
router.get('/emergencias', asyncHandler(ctrl.emergencias));
router.get('/proveedores', asyncHandler(ctrl.proveedores));

export default router;
