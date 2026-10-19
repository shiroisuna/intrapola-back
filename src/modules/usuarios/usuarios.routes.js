import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { enviarPdf } from '../../utils/pdf.js';
import { opciones } from './usuarios.constantes.js';
import * as service from './usuarios.service.js';
import { hojaUsuarios } from './usuarios.pdf.js';

const router = Router();
const codigos = z.array(z.string().max(40)).max(20).default([]);

const nueva = z.object({
  cedula: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida'),
  nombreUsuario: z.string().trim().min(1, 'Indique el nombre del usuario').max(150, 'Máximo 150 caracteres'),
  cedulaUsuario: z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida').optional().or(z.literal('').transform(() => undefined)),
  cargoUsuario: z.string().trim().min(1, 'Indique el cargo').max(150, 'Máximo 150 caracteres'),
  comunicacion: codigos,
  sap: codigos,
  spi: codigos,
  otrosSistemas: codigos,
  observaciones: z.string().trim().max(500, 'Máximo 500 caracteres').optional().transform((v) => v || null),
});

router.get('/opciones', (_req, res) => res.json(opciones()));
router.post('/', validate(nueva), asyncHandler(async (req, res) => res.status(201).json(await service.crear(req.body))));
router.get('/:id/pdf', validate(z.object({ id: z.coerce.number().int().positive() }), 'params'), asyncHandler(async (req, res) => {
  const d = await service.datosHoja(req.params.id);
  enviarPdf(res, hojaUsuarios(d), `usuario-${String(d.id).padStart(6, '0')}.pdf`);
}));

export default router;
