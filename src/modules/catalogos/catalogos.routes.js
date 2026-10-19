import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as ctrl from './catalogos.controller.js';

const router = Router();

router.get('/tipos-solicitud', validate(z.object({ area: z.enum(['RRHH', 'SISTEMAS', 'SERVICIOS']).optional() }), 'query'), asyncHandler(ctrl.tiposSolicitud));
router.get('/articulos', validate(z.object({ categoria: z.enum(['PAPELERIA', 'INSUMO_SIST']) }), 'query'), asyncHandler(ctrl.articulos));
router.get('/accesos', asyncHandler(ctrl.accesos));
router.get('/tipos-soporte', asyncHandler(ctrl.tiposSoporte));
router.get('/departamentos', asyncHandler(ctrl.departamentos));

export default router;
