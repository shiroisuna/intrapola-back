import * as service from './permisos.service.js';
import { hojaPermiso } from './permisos.pdf.js';
import { enviarPdf } from '../../utils/pdf.js';

export async function crear(req, res) {
  res.status(201).json(await service.crear(req.body));
}

export async function pdf(req, res) {
  const datos = await service.datosHoja(req.params.id);
  enviarPdf(res, hojaPermiso(datos), `permiso-${String(datos.id).padStart(6, '0')}.pdf`);
}
