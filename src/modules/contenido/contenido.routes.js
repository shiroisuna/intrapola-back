import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';
import { uploader } from '../../middlewares/upload.js';
import * as ctrl from './contenido.controller.js';

const router = Router();

const id = z.object({ id: z.coerce.number().int().positive() });
router.get('/inicio', asyncHandler(ctrl.inicio));

router.get('/comunicados', validate(z.object({ limite: z.coerce.number().int().min(1).max(50).default(20) }), 'query'), asyncHandler(ctrl.listarComunicados));
router.get('/comunicados/:id', validate(id, 'params'), asyncHandler(ctrl.obtenerComunicado));
// Gestión (protegida con x-admin-token): se sube la imagen en el campo "imagen"
router.post('/comunicados', requireAdmin, uploader('comunicados').single('imagen'), asyncHandler(ctrl.crearComunicado));
router.delete('/comunicados/:id', requireAdmin, validate(id, 'params'), asyncHandler(ctrl.desactivarComunicado));

router.post('/banners', requireAdmin, uploader('banners').single('imagen'), asyncHandler(ctrl.crearBanner));
router.delete('/banners/:id', requireAdmin, validate(id, 'params'), asyncHandler(ctrl.desactivarBanner));

export default router;
