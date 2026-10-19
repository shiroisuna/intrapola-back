import { z } from 'zod';
import { badRequest } from '../utils/http.js';

z.config(z.locales.es()); // mensajes de validación en español

/**
 * Valida req[source] con un esquema zod y reemplaza el valor por el resultado
 * ya limpio (tipos convertidos, campos extra eliminados).
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return next(badRequest('Revise los datos del formulario', details));
  }
  if (source === 'query') {
    Object.defineProperty(req, 'validQuery', { value: result.data });
  } else {
    req[source] = result.data;
  }
  next();
};
