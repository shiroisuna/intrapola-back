import * as repo from './documentos.repository.js';
import { cached, invalidate } from '../../utils/cache.js';
import { publicUrl } from '../../middlewares/upload.js';
import { badRequest } from '../../utils/http.js';

export const normas = async (_req, res) => res.json(await cached('doc:NORMA', 600, () => repo.porCategoria('NORMA')));
export const formatos = async (_req, res) => res.json(await cached('doc:FORMATO', 600, () => repo.porCategoria('FORMATO')));

export async function crear(req, res) {
  if (!req.file) throw badRequest('Adjunte el archivo del documento');
  const row = await repo.crear({ ...req.body, archivoUrl: publicUrl('documentos', req.file) });
  invalidate(`doc:${req.body.categoria}`);
  res.status(201).json(row);
}
