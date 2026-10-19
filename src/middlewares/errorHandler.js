import multer from 'multer';
import { HttpError } from '../utils/http.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, detalles: err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `El archivo supera ${env.maxUploadMb} MB`
      : 'No se pudo recibir el archivo';
    return res.status(400).json({ error: msg });
  }
  // Errores de SQL Server: clave foránea / única
  if (err?.number === 547) return res.status(400).json({ error: 'Uno de los datos seleccionados no existe' });
  // Texto más largo que la columna de la tabla vieja
  if (err?.number === 8152 || err?.number === 2628) return res.status(400).json({ error: 'Uno de los textos es demasiado largo. Acórtelo e intente de nuevo.' });
  if (err?.number === 2627 || err?.number === 2601) return res.status(409).json({ error: 'El registro ya existe' });
  if (err?.code === 'ESOCKET' || err?.code === 'ELOGIN' || err?.code === 'ETIMEOUT') {
    console.error('[db]', err.message);
    return res.status(503).json({ error: 'La base de datos no está disponible en este momento' });
  }

  // Oracle (SPI): NJS-138 = versión no soportada en modo Thin; NJS-5xx / ORA-12xxx = sin conexión
  const msg = String(err?.message || '');
  if (/^(NJS|ORA|DPI)-/.test(msg)) {
    console.error(`[spi] ${msg.split('\n')[0]}`);
    if (/^NJS-138/.test(msg)) {
      return res.status(503).json({ error: 'El SPI usa una versión de Oracle que requiere Oracle Instant Client (ver ORACLE_CLIENT_DIR en el .env)' });
    }
    if (/^(NJS-5\d\d|ORA-12\d{3}|ORA-01017|DPI-1047)/.test(msg)) {
      return res.status(503).json({ error: 'No hay conexión con el SPI en este momento' });
    }
    return res.status(500).json({ error: 'Error al consultar el SPI', ...(env.nodeEnv !== 'production' && { detalle: msg }) });
  }

  // Errores de SQL (tabla/columna inexistente, sintaxis...): una línea en consola, sin el stack completo
  if (err?.code === 'EREQUEST') console.error(`[sql ${err.number}] ${err.message}`);
  else console.error(err);
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(env.nodeEnv !== 'production' && { detalle: err.message }),
  });
}
