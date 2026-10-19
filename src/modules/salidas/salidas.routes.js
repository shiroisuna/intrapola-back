import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { enviarPdf } from '../../utils/pdf.js';
import * as service from './salidas.service.js';
import { hojaSalida } from './salidas.pdf.js';

const router = Router();
const fecha = (msg) => z.string({ error: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, msg);

const nueva = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  fechaSalida: fecha('Indique la fecha de salida'),
  retorna: z.boolean({ error: 'Indique si el material retorna' }),
  fechaRetorno: fecha('Indique la fecha estimada de retorno').optional().or(z.literal('').transform(() => undefined)),
  retira: z.string().trim().min(1, 'Indique quién retira').max(150, 'Máximo 150 caracteres'),
  cedulaRetira: z.string().trim().max(20, 'Máximo 20 caracteres').optional().transform((v) => v || null),
  observacion: z.string().trim().max(500, 'Máximo 500 caracteres').optional().transform((v) => v || null),
  items: z.array(z.object({
    descripcion: z.string().trim().min(1, 'Describa el material o equipo').max(300, 'Máximo 300 caracteres'),
    cantidad: z.coerce.number({ error: 'Cantidad inválida' }).positive('Cantidad inválida').max(99999),
  })).min(1, 'Agregue al menos un material o equipo').max(50, 'Máximo 50 renglones'),
}).superRefine((d, ctx) => {
  if (d.retorna && !d.fechaRetorno) ctx.addIssue({ code: 'custom', path: ['fechaRetorno'], message: 'Indique la fecha estimada de retorno' });
  if (d.retorna && d.fechaRetorno && d.fechaRetorno < d.fechaSalida) ctx.addIssue({ code: 'custom', path: ['fechaRetorno'], message: 'El retorno no puede ser antes de la salida' });
});

router.post('/', validate(nueva), asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body))));
router.get('/:numero/pdf', validate(z.object({ numero: z.coerce.number().int().positive() }), 'params'), asyncHandler(async (req, res) => {
  const d = await service.datosHoja(req.params.numero);
  enviarPdf(res, hojaSalida(d), `salida-${String(d.numero).padStart(6, '0')}.pdf`);
}));

export default router;
