import * as service from './papeleria.service.js';
import { hojaPapeleria } from './papeleria.pdf.js';
import { enviarPdf } from '../../utils/pdf.js';

export async function crear(req, res) {
  res.status(201).json(await service.crear(req.body));
}

export async function pdf(req, res) {
  const datos = await service.datosHoja(req.params.numero);
  enviarPdf(res, hojaPapeleria(datos), `papeleria-${String(datos.numero).padStart(6, '0')}.pdf`);
}
