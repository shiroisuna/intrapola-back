import { cached } from '../../utils/cache.js';
import { pendiente } from '../../utils/http.js';
import * as normasSvc from './normas.service.js';

// Normas: PDF en la carpeta NORMAS_DIR (ver normas.service.js)
export const normas = async (_req, res) => res.json(await cached('doc:NORMA', 300, async () => normasSvc.listar()));

export function archivoNorma(req, res) {
  const ruta = normasSvc.archivo(req.params.archivo);
  const nombre = encodeURIComponent(req.params.archivo);
  res.set('Content-Disposition', `${'descargar' in req.query ? 'attachment' : 'inline'}; filename*=UTF-8''${nombre}`);
  res.sendFile(ruta, { headers: { 'Content-Type': 'application/pdf' } });
}

// Formatos generales: siguen pendientes (los formatos con pantalla propia están en /formatos)
export const formatos = async () => { throw pendiente('Formatos'); };
