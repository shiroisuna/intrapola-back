import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { enviarPdf } from '../../utils/pdf.js';
import * as service from './relgastos.service.js';
import { hojaRelacionGastos } from './relgastos.pdf.js';

const router = Router();
const monto = z.coerce.number({ error: 'Monto inválido' }).min(0, 'Monto inválido').max(1e12)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Máximo dos decimales');

const nueva = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  concepto: z.string().trim().min(1, 'Indique el concepto').max(300, 'Máximo 300 caracteres'),
  anticipo: monto.default(0),
  observaciones: z.string().trim().max(500, 'Máximo 500 caracteres').optional().transform((v) => v || null),
  gastos: z.array(z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    tipo: z.string().trim().min(1, 'Indique el tipo de gasto').max(100),
    monto: monto.refine((n) => n > 0, 'El monto debe ser mayor que cero'),
  })).min(1, 'Agregue al menos un gasto').max(100, 'Máximo 100 gastos'),
});

router.get('/tipos', asyncHandler(async (_req, res) => res.json(await service.tipos())));
router.post('/', validate(nueva), asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body))));
router.get('/:numero/pdf', validate(z.object({ numero: z.coerce.number().int().positive() }), 'params'), asyncHandler(async (req, res) => {
  const d = await service.datosHoja(req.params.numero);
  enviarPdf(res, hojaRelacionGastos(d), `relacion-gastos-${String(d.numero).padStart(6, '0')}.pdf`);
}));

export default router;
