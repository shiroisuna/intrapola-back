import crypto from 'node:crypto';
import { HttpError } from '../../utils/http.js';

/*
 * Sesión del panel de administración: un solo usuario definido en el .env
 *   ADMIN_USUARIO (por defecto "admin") y ADMIN_CLAVE.
 * Token firmado con HMAC (ADMIN_SECRETO; si no se define, las sesiones se pierden al reiniciar la API).
 */
const HORAS_SESION = 8;
const secreto = process.env.ADMIN_SECRETO || crypto.randomBytes(32).toString('hex');

const iguales = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const firmar = (datos) => crypto.createHmac('sha256', secreto).update(datos).digest('base64url');

/* ---- Freno a intentos fallidos (por IP): 5 intentos → 15 minutos ---- */
const intentos = new Map();
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60_000;

export function iniciarSesion({ usuario, clave }, ip) {
  const esperadoUsuario = process.env.ADMIN_USUARIO || 'admin';
  const esperadaClave = process.env.ADMIN_CLAVE;
  if (!esperadaClave) throw new HttpError(503, 'El panel de administración no está habilitado: falta ADMIN_CLAVE en el .env del servidor');

  const r = intentos.get(ip);
  if (r && r.n >= MAX_INTENTOS && r.hasta > Date.now()) {
    const min = Math.ceil((r.hasta - Date.now()) / 60_000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intente de nuevo en ${min} minuto${min === 1 ? '' : 's'}.`);
  }
  // Se comparan ambos siempre (sin cortocircuito) para no revelar cuál falló
  const okUsuario = iguales(usuario.toLowerCase(), esperadoUsuario.toLowerCase());
  const okClave = iguales(clave, esperadaClave);
  if (!(okUsuario && okClave)) {
    const n = r && r.hasta > Date.now() ? r.n + 1 : 1;
    intentos.set(ip, { n, hasta: Date.now() + BLOQUEO_MS });
    throw new HttpError(401, 'Usuario o clave incorrectos');
  }
  intentos.delete(ip);

  const expira = Date.now() + HORAS_SESION * 3_600_000;
  const datos = Buffer.from(JSON.stringify({ u: esperadoUsuario, exp: expira, rol: 'admin' })).toString('base64url');
  return { token: `${datos}.${firmar(datos)}`, usuario: esperadoUsuario, expira: new Date(expira).toISOString() };
}

/** Devuelve { u, exp } si el token es válido y no ha vencido; si no, null. */
export function leerToken(token) {
  const [datos, firma] = String(token || '').split('.');
  if (!datos || !firma || !iguales(firma, firmar(datos))) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return s.rol === 'admin' && s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}
