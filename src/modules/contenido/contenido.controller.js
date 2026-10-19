import * as repo from './contenido.repository.js';
import { cached, invalidate } from '../../utils/cache.js';
import { badRequest, notFound } from '../../utils/http.js';

/**
 * Todo lo que necesita la página de inicio en una sola petición.
 * Cada bloque falla por separado: si una tabla aún no existe, el resto se muestra igual.
 */
export async function inicio(_req, res) {
  const data = await cached('contenido:inicio', 120, async () => {
    const seguro = (p, vacio) => p.catch((err) => { console.warn('[contenido]', err.message); return vacio; });
    const [banners, comunicados, productos, enlaces, empresa] = await Promise.all([
      seguro(repo.banners(), []),
      seguro(repo.comunicadosVigentes(5), []),
      repo.productos(),
      repo.enlaces(),
      repo.empresa(),
    ]);
    return { banners, comunicados, productos, enlaces, empresa };
  });
  res.json(data);
}

/* --------------------------- Comunicados ------------------------------ */
export async function listarComunicados(req, res) {
  res.json(await cached(`comunicados:${req.validQuery.limite}`, 120, () => repo.comunicadosVigentes(req.validQuery.limite)));
}

export async function obtenerComunicado(req, res) {
  const c = await repo.comunicadoPorId(req.params.id);
  if (!c) throw notFound('El comunicado no existe o ya no está vigente');
  res.json(c);
}

export async function crearComunicado(req, res) {
  if (!req.file) throw badRequest('Adjunte la imagen del comunicado');
  const row = await repo.crearComunicado({ archivo: req.file.filename, ruta: '/uploads/comunicados/' });
  invalidate('comunicados:');
  invalidate('contenido:');
  res.status(201).json(row);
}

export async function desactivarComunicado(req, res) {
  const [row] = await repo.desactivarComunicado(req.params.id);
  if (!row) throw notFound('El comunicado no existe');
  invalidate('comunicados:');
  invalidate('contenido:');
  res.status(204).end();
}

/* ----------------------------- Banners -------------------------------- */
export async function crearBanner(req, res) {
  if (!req.file) throw badRequest('Adjunte la imagen del banner');
  const row = await repo.crearBanner({ archivo: req.file.filename, ruta: '/uploads/banners/' });
  invalidate('contenido:');
  res.status(201).json(row);
}

export async function desactivarBanner(req, res) {
  const [row] = await repo.desactivarBanner(req.params.id);
  if (!row) throw notFound('El banner no existe');
  invalidate('contenido:');
  res.status(204).end();
}
