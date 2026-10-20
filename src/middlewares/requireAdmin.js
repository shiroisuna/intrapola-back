import crypto from 'node:crypto';
import { HttpError } from '../utils/http.js';
import { leerToken } from '../modules/admin/admin.sesion.js';

/**
 * Protege las operaciones de gestión. Acepta:
 *   - Authorization: Bearer <token>  del panel de administración (POST /api/admin/sesion)
 *   - x-admin-token igual a ADMIN_TOKEN del .env (para scripts o integraciones)
 */
export function requireAdmin(req, _res, next) {
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const sesion = bearer && leerToken(bearer);
  if (sesion) {
    req.admin = sesion;
    return next();
  }

  const esperado = process.env.ADMIN_TOKEN;
  const recibido = req.get('x-admin-token') || '';
  if (esperado && recibido.length === esperado.length
    && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))) {
    req.admin = { u: 'token' };
    return next();
  }
  next(new HttpError(401, bearer ? 'Su sesión de administración venció. Ingrese de nuevo.' : 'No autorizado'));
}
