import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http.js';
import { MINUTOS_SESION } from './anticipos.constantes.js';

/*
 * Sesión del portal de anticipos (equivale a Session["usuario"], ["nombre"] y ["correo"] del C#).
 * Token firmado con HMAC; vive solo en la memoria del navegador y vence en MINUTOS_SESION.
 */
const secreto = env.anticipos.secreto || crypto.randomBytes(32).toString('hex');
if (!env.anticipos.secreto) console.warn('[anticipos] ANTICIPOS_SECRETO no está definido: las sesiones se pierden al reiniciar la API');

const b64 = (s) => Buffer.from(s).toString('base64url');
const firmar = (datos) => crypto.createHmac('sha256', secreto).update(datos).digest('base64url');

export function crearToken(usuario) {
  const datos = b64(JSON.stringify({ ...usuario, exp: Date.now() + MINUTOS_SESION * 60_000 }));
  return `${datos}.${firmar(datos)}`;
}

function leerToken(token) {
  const [datos, firma] = String(token || '').split('.');
  if (!datos || !firma) return null;
  const esperada = firmar(datos);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  try {
    const usuario = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return usuario.exp > Date.now() ? usuario : null;
  } catch {
    return null;
  }
}

/** Middleware: exige "Authorization: Bearer <token>" y deja el usuario en req.usuarioAnticipo. */
export function requireSesion(req, _res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const usuario = leerToken(token);
  if (!usuario) return next(new HttpError(401, 'Su sesión venció. Ingrese de nuevo.'));
  req.usuarioAnticipo = usuario;
  next();
}

/* ---- Freno a intentos fallidos de inicio de sesión (5 intentos → 15 minutos) ---- */
const intentos = new Map();
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60_000;

export function verificarBloqueo(cedula) {
  const r = intentos.get(cedula);
  if (r && r.n >= MAX_INTENTOS && r.hasta > Date.now()) {
    const min = Math.ceil((r.hasta - Date.now()) / 60_000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intente de nuevo en ${min} minuto${min === 1 ? '' : 's'}.`);
  }
}
export function registrarFallo(cedula) {
  const r = intentos.get(cedula);
  const n = r && r.hasta > Date.now() ? r.n + 1 : 1;
  intentos.set(cedula, { n, hasta: Date.now() + BLOQUEO_MS });
}
export const limpiarFallos = (cedula) => intentos.delete(cedula);
