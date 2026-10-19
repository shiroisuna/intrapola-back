import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, notFound } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { enviarPdf } from '../../utils/pdf.js';
import { configPublica, EVALUACIONES } from './evaluaciones.config.js';
import * as service from './evaluaciones.service.js';
import * as repo from './evaluaciones.repository.js';
import { hojaEvaluacion } from './evaluaciones.pdf.js';

const router = Router();
const clave = z.object({ clave: z.enum(Object.keys(EVALUACIONES), { error: 'Tipo de evaluación no disponible' }) });
const contrato = z.string().trim().min(1, 'Indique el contrato u orden').max(50, 'Máximo 50 caracteres');

router.get('/proveedores', validate(z.object({ rif: z.string().trim().min(5, 'RIF inválido').max(20) }), 'query'),
  asyncHandler(async (req, res) => res.json(await service.proveedor(req.validQuery.rif))));

router.get('/contratos', validate(z.object({ contrato }), 'query'),
  asyncHandler(async (req, res) => res.json(await service.contratoEvaluado(req.validQuery.contrato))));

router.get('/:clave', validate(clave, 'params'), asyncHandler(async (req, res) => {
  const c = configPublica(req.params.clave);
  if (!c) throw notFound('Tipo de evaluación no disponible');
  // Largo real de las columnas (para que el formulario no deje escribir más de lo que cabe)
  const limites = await repo.limites().catch(() => ({}));
  res.json({ ...c, limites, campos: c.campos.map((x) => (limites[x.nombre] ? { ...x, max: Math.min(x.max ?? Infinity, limites[x.nombre]) } : x)) });
}));

/* Esquema de cada evaluación: lo común + sus campos propios (ver campos en evaluaciones.config.js) */
const opc = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().transform((v) => v || null);
const req = (max, msg) => z.string({ error: msg }).trim().min(1, msg).max(max, `Máximo ${max} caracteres`);
const cantidad = (msg) => z.coerce.number({ error: msg }).min(0, msg).max(1e9);
const base = z.object({
  fecha: z.string({ error: 'Indique la fecha' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Indique la fecha de evaluación'),
  rif: z.string({ error: 'Indique el RIF' }).trim().min(5, 'RIF inválido').max(20),
  observaciones: opc(1000),
  cedulaEvaluador: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  respuestas: z.record(z.string(), z.object({ cumple: z.boolean(), puntos: z.coerce.number().int().min(0).max(100) })),
});
const ESQUEMAS = {
  servicios: base.extend({ contrato, factura: opc(50), descripcion: req(300, 'Indique el tipo de servicio ejecutado') }),
  mpme: base.extend({
    contrato,
    factura: req(50, 'Indique el documento factura / NE'),
    tipoProveedor: z.enum(EVALUACIONES.mpme.campos.find((c) => c.nombre === 'tipoProveedor').opciones, { error: 'Seleccione el tipo de proveedor' }),
    descripcion: req(300, 'Indique el material suministrado'),
    cantSuministrada: cantidad('Indique la cantidad suministrada'),
    cantRechazada: cantidad('Cantidad rechazada inválida').default(0),
    lote: req(50, 'Indique el lote Amapola'),
  }),
  transporte: base.extend({ correo: z.email('Correo inválido').max(150).optional().or(z.literal('').transform(() => undefined)) }),
};
const validarSegunTipo = (req, res, next) => validate(ESQUEMAS[req.params.clave])(req, res, next);

router.get('/:clave/numero', validate(clave, 'params'), validate(z.object({
  rif: z.string().trim().min(5).max(20),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}), 'query'), asyncHandler(async (req, res) => res.json(await service.numeroAutomatico(req.params.clave, req.validQuery))));

router.post('/:clave', validate(clave, 'params'), validarSegunTipo,
  asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.params.clave, req.body))));

router.get('/:clave/pdf', validate(clave, 'params'), validate(z.object({ contrato }), 'query'), asyncHandler(async (req, res) => {
  const d = await service.datosHoja(req.params.clave, req.validQuery.contrato);
  enviarPdf(res, hojaEvaluacion(d), `${d.formato.codigo}-${d.contrato.replace(/[^\w-]/g, '_')}.pdf`);
}));

export default router;
