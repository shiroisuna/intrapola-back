import crypto from 'node:crypto';
import { HttpError } from '../utils/http.js';

/**
 * Protección simple para operaciones de gestión mientras no haya inicio de sesión:
 * exige el encabezado  x-admin-token  igual a ADMIN_TOKEN del .env.
 */
export function requireAdmin(req, _res, next) {
  const esperado = process.env.ADMIN_TOKEN;
  const recibido = req.get('x-admin-token') || '';
  if (!esperado) return next(new HttpError(503, 'Gestión deshabilitada: configure ADMIN_TOKEN'));
  const ok = recibido.length === esperado.length
    && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
  if (!ok) return next(new HttpError(401, 'No autorizado'));
  next();
}
