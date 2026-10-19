import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as ctrl from './empleados.controller.js';

const router = Router();

const busqueda = z.object({
  q: z.string().trim().min(2, 'Escriba al menos 2 caracteres').optional(),
  departamento: z.string().trim().min(2).optional(),
}).refine((d) => d.q || d.departamento, 'Indique q (cédula o nombre) o departamento');

router.get('/', validate(busqueda, 'query'), asyncHandler(ctrl.buscar));
router.get('/:cedula', validate(z.object({ cedula: z.string().regex(/^\d{5,10}$/, 'Cédula inválida') }), 'params'), asyncHandler(ctrl.obtenerPorCedula));

export default router;
