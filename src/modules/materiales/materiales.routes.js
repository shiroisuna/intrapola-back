import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import * as service from './materiales.service.js';
import { TIPOS, VERIFICACION } from './materiales.constantes.js';

const router = Router();
const txt = (max, msg) => z.string({ error: msg }).trim().min(1, msg).max(max, `Máximo ${max} caracteres`);
const opc = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().transform((v) => v || null);

const nueva = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  solicitud: z.enum(TIPOS.map((t) => t.valor), { error: 'Seleccione el tipo de solicitud' }),
  fecha: z.string({ error: 'Indique la fecha' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Indique la fecha'),
  motivo: txt(500, 'Indique el motivo de la solicitud'),
  autoriza: txt(150, 'Indique quién autoriza'),
  existe: z.enum(VERIFICACION.map((v) => v.valor), { error: 'Indique si el material existe en SAP' }),
  codigo: opc(50),
  observaciones: txt(1000, 'Escriba las observaciones de la creación, modificación o desincorporación'),
  material: txt(300, 'Escriba el texto descriptivo del material'),
  codigoAnterior: opc(50),
  almacen: txt(100, 'Indique el almacén'),
  um: txt(20, 'Indique la unidad de medida'),
  grCompras: opc(50),
  grArt: opc(50),
  ptoPedido: opc(30),
  max: opc(30),
  stockSeg: opc(30),
  obsPlanificacion: opc(500),
});

router.get('/opciones', (_req, res) => res.json({ tipos: TIPOS, verificacion: VERIFICACION }));
router.post('/', validate(nueva), asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body))));

export default router;
