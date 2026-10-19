import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { HttpError } from '../../utils/http.js';

/*
 * Formatos fijos que se publican como PDF (equivale a PDFview.aspx).
 * El archivo vive en el servidor; la ruta se puede cambiar en el .env sin tocar código.
 */
const ARCHIVOS = {
  'reembolso-seguro': {
    ruta: () => process.env.FORMATO_REEMBOLSO_SEGURO || 'assets/formatos/reembolso-seguro.pdf',
    nombre: 'Solicitud-reembolso-seguro.pdf',
  },
};

const router = Router();

/** GET /api/formatos/archivo/reembolso-seguro          → se abre en el navegador
 *  GET /api/formatos/archivo/reembolso-seguro?descargar → se descarga */
router.get('/archivo/:clave', (req, res, next) => {
  const formato = ARCHIVOS[req.params.clave];
  if (!formato) return next(new HttpError(404, 'Formato no encontrado'));
  const ruta = path.resolve(formato.ruta());
  if (!fs.existsSync(ruta)) {
    console.warn(`[formatos] no existe el archivo ${ruta}`);
    return next(new HttpError(404, 'El formato todavía no está cargado en el servidor. Avise a Sistemas.'));
  }
  const modo = 'descargar' in req.query ? 'attachment' : 'inline';
  res.set('Content-Disposition', `${modo}; filename="${formato.nombre}"`);
  res.sendFile(ruta, { headers: { 'Content-Type': 'application/pdf' } });
});

export default router;
