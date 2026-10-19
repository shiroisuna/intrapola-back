import { HttpError, notFound } from '../../utils/http.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './papeleria.repository.js';

/** "JOSE" + "MARIN" → "JOSE-MARIN" (formato que usa la Intrapola actual en emplesol/usuario_temp). */
const usuarioLegacy = empleados.nombreLegacy;

// Observaciones: no hay columna en solpedpapeleria; se conservan unas horas para la hoja recién emitida.
const observaciones = new Map();

export async function crear({ cedula, items, observaciones: obs }) {
  const empleado = await empleados.findByCedula(cedula);
  if (!empleado) throw notFound('No hay un trabajador activo con esa cédula');

  let r;
  try {
    r = await repo.crear({
      cedula: empleado.cedula,
      usuario: usuarioLegacy(empleado),
      departamento: empleado.departamento,
      items,
    });
  } catch (err) {
    if (err.status === 400) throw new HttpError(400, err.message);
    throw err;
  }

  if (obs) {
    observaciones.set(r.numero, { texto: obs, expira: Date.now() + 12 * 3600_000 });
    for (const [k, v] of observaciones) if (v.expira < Date.now()) observaciones.delete(k);
  }

  return {
    id: r.numero,
    numero: String(r.numero).padStart(6, '0'),
    estado: 'PENDIENTE',
    creadaEn: new Date().toISOString(),
    solicitante: empleado.nombreCompleto,
    pdfUrl: `/api/solicitudes/papeleria/${r.numero}/pdf`,
  };
}

/** Datos completos para la hoja PDF (la cabecera ya trae cédula y departamento). */
export async function datosHoja(numero) {
  const s = await repo.obtener(numero);
  if (!s) throw notFound('La solicitud de papelería no existe');

  // Nombre y cargo actualizados desde el SPI (si no responde, se usa lo guardado)
  const emp = await empleados.findByCedula(s.cedula).catch(() => null);
  return {
    ...s,
    nombre: emp?.nombreCompleto || s.usuario.replace(/-/g, ' '),
    ficha: emp?.ficha || null,
    cargo: emp?.cargo || null,
    observaciones: observaciones.get(Number(numero))?.texto || null,
  };
}
