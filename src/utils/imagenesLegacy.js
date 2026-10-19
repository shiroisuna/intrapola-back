import { env } from '../config/env.js';

/**
 * URL pública de una imagen guardada como ruta + archivo (ej. "/intrapola/imagenes/" + "foto.png").
 * - Rutas de la Intrapola actual  -> se sirven desde el IIS (LEGACY_BASE_URL).
 * - Rutas que empiezan por /uploads/ -> archivos subidos desde la Intrapola nueva (relativas a esta API).
 */
export function urlImagen(ruta, archivo) {
  const r = (ruta || '').trim();
  const a = (archivo || '').trim();
  if (!a) return null;
  const carpeta = r.endsWith('/') || !r ? r : `${r}/`;
  const relativa = `${carpeta}${encodeURIComponent(a)}`;
  return relativa.startsWith('/uploads/') ? relativa : `${env.legacyBaseUrl}${relativa.startsWith('/') ? '' : '/'}${relativa}`;
}

/**
 * Convierte una ruta de la app ASP.NET a URL absoluta:
 *   "~/imagenes/x.jpg"   -> http://192.168.10.112/intrapola/imagenes/x.jpg
 *   "/Content/img/x.png" -> http://192.168.10.112/Content/img/x.png
 * Codifica espacios y caracteres especiales de cada segmento.
 */
export function urlLegacy(ruta) {
  const r = (ruta || '').trim();
  if (!r) return null;
  if (/^https?:\/\//i.test(r)) return r;
  const absoluta = r.startsWith('~/') ? `${env.legacyAppPath}/${r.slice(2)}` : (r.startsWith('/') ? r : `/${r}`);
  const codificada = absoluta.split('/').map((seg) => {
    try { return encodeURIComponent(decodeURIComponent(seg)); } catch { return encodeURIComponent(seg); }
  }).join('/');
  return `${env.legacyBaseUrl}${codificada}`;
}

/** "TOP10-ACADEMIA-MARY-02-07-2025.jpg" -> "TOP10 ACADEMIA MARY 02 07 2025" (texto alternativo). */
export const tituloDesdeArchivo = (archivo = '') =>
  archivo.trim().replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_]+/g, ' ').trim() || 'Imagen';
