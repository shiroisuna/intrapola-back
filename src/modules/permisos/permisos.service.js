import { badRequest, notFound } from '../../utils/http.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './permisos.repository.js';

/*
 * La tabla permisos no guarda cédula ni observaciones (igual que en la Intrapola actual, donde
 * iban por Session solo para imprimir). Se conservan en memoria unas horas para que la hoja PDF
 * recién emitida los incluya; al reimprimir después, la cédula se recupera del SPI por la ficha.
 */
const extras = new Map();
const HORAS_EXTRAS = 12;
function guardarExtras(id, datos) {
  extras.set(id, { ...datos, expira: Date.now() + HORAS_EXTRAS * 3600_000 });
  for (const [k, v] of extras) if (v.expira < Date.now()) extras.delete(k);
}

export async function crear(d) {
  const empleado = await empleados.findByCedula(d.cedula);
  if (!empleado) throw notFound('No hay un trabajador activo con esa cédula');
  if (!empleado.ficha) throw badRequest('El trabajador no tiene ficha registrada en el SPI');

  const nombre = empleado.nombreCompleto;
  const id = await repo.insertar({
    fechaPermiso: d.fechaPermiso,
    nombre,
    ficha: empleado.ficha,
    motivo: d.motivo,
    tipoPermiso: d.tipoPermiso,
    tiempo: d.tiempo,
    medida: d.medida,
  });

  guardarExtras(id, {
    cedula: empleado.cedula,
    departamento: empleado.departamento,
    cargo: empleado.cargo,
    nomina: empleado.nomina,
    observaciones: d.observaciones,
  });

  return {
    id,
    numero: String(id).padStart(6, '0'),
    estado: 'PENDIENTE',
    creadaEn: new Date().toISOString(),
    solicitante: nombre,
    pdfUrl: `/api/solicitudes/permisos/${id}/pdf`,
  };
}

/** Datos completos para la hoja PDF. */
export async function datosHoja(id) {
  const p = await repo.obtener(id);
  if (!p) throw notFound('El permiso no existe');

  let extra = extras.get(id);
  if (!extra) {
    // Reimpresión: completar con el SPI por ficha (si el SPI no responde, la hoja sale sin esos datos)
    const emp = await empleados.findByFicha(p.ficha).catch(() => null);
    extra = emp ? { cedula: emp.cedula, departamento: emp.departamento, cargo: emp.cargo, nomina: emp.nomina } : {};
  }
  return { ...p, ...extra };
}
