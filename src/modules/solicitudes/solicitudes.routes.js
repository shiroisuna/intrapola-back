import { Router } from 'express';
import { asyncHandler, HttpError } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';
import * as s from './solicitudes.schemas.js';
import * as ctrl from './solicitudes.controller.js';

const router = Router();

router.get('/', validate(s.listarSchema, 'query'), asyncHandler(ctrl.listar));
router.get('/:id', validate(s.idSchema, 'params'), asyncHandler(ctrl.obtener));

/*
 * Pendientes de adaptar a sus tablas reales (necesitan el C# de cada formulario):
 *   desarrollos → CAA.intrapola_ssoporte_desarollos
 *   insumos     → CAA.Insumos_sist_det
 * Mientras tanto responden 501 con un mensaje claro en vez de fallar contra tablas que no existen.
 */
const enAdaptacion = (nombre) => (_req, _res, next) => next(new HttpError(501,
  `La solicitud de ${nombre} todavía se está pasando a la nueva Intrapola. Por ahora hágala desde la Intrapola actual.`));

router.post('/insumos', enAdaptacion('insumos de sistemas'));
router.post('/desarrollos', enAdaptacion('desarrollo de aplicaciones'));

// Gestión (RRHH / Sistemas): protegido con token mientras no exista login
router.patch('/:id/estado', requireAdmin, validate(s.idSchema, 'params'), validate(s.estadoSchema), asyncHandler(ctrl.cambiarEstado));

export default router;
