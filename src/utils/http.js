export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (msg = 'Recurso no encontrado') => new HttpError(404, msg);
/** Módulo aún sin fuente de datos: responde 501 con un mensaje claro (sin ensuciar la consola). */
export const pendiente = (modulo) => new HttpError(501, `${modulo}: pendiente por conectar a la base de datos`);
export const badRequest = (msg, details) => new HttpError(400, msg, details);

/** Envuelve controladores async para que los errores lleguen al errorHandler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
