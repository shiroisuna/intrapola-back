import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { enviarPdf } from '../../utils/pdf.js';
import * as service from './vacaciones.service.js';
import { hojaVacaciones } from './vacaciones.pdf.js';

const router = Router();

const cedula = z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida');
const fecha = (msg) => z.string({ error: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, msg)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), msg);

const consulta = z.object({ cedula, inicio: fecha('Indique la fecha de salida') });
const nueva = consulta.extend({
  periodo: z.string().trim().min(1, 'Indique el período').max(20, 'Máximo 20 caracteres'),
});

router.get('/calculo', validate(consulta, 'query'), asyncHandler(async (req, res) => {
  const { empleado, ...calculo } = await service.calcular(req.validQuery);
  res.json(calculo);
}));
router.post('/', validate(nueva), asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body))));
router.get('/pdf', validate(consulta, 'query'), asyncHandler(async (req, res) => {
  const d = await service.datosHoja(req.validQuery);
  enviarPdf(res, hojaVacaciones(d), `vacaciones-${d.cedula}-${d.inicio}.pdf`);
}));

export default router;
