import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import * as ctrl from './documentos.controller.js';

const router = Router();

router.get('/normas', asyncHandler(ctrl.normas));
router.get('/normas/archivo/:archivo', ctrl.archivoNorma);
router.get('/formatos', asyncHandler(ctrl.formatos));

export default router;
