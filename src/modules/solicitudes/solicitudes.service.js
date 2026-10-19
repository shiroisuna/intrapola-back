import { caa } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/http.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './solicitudes.repository.js';

/**
 * Flujo común a todas las solicitudes:
 * 1. valida al trabajador (BD amapolanet, fuera de la transacción)
 * 2. inserta cabecera + detalle en CAA dentro de una transacción
 */
async function crear({ tipoCodigo, cedula, descripcion = null, adjuntoUrl = null }, guardarDetalle) {
  const empleado = await empleados.findByCedula(cedula);
  if (!empleado) throw notFound('No hay un trabajador activo con esa cédula');

  return caa.withTransaction(async (tx) => {
    const tipo = await repo.findTipo(tipoCodigo, tx);
    if (!tipo) throw badRequest('Tipo de solicitud no disponible');

    const cab = await repo.insertCabecera(
      { tipoId: tipo.id, cedula, departamentoId: empleado.departamentoId, descripcion, adjuntoUrl }, tx,
    );
    if (guardarDetalle) await guardarDetalle(cab.id, tx);

    return { id: cab.id, numero: String(cab.id).padStart(6, '0'), tipo: tipo.nombre, estado: cab.estado, creadaEn: cab.creadaEn, solicitante: empleado.nombreCompleto };
  });
}

export const crearPermiso = (d) =>
  crear({ tipoCodigo: 'PERMISO', cedula: d.cedula, descripcion: d.motivo }, (id, tx) => repo.insertPermiso(id, d, tx));

export const crearRrhh = (d) =>
  crear({ tipoCodigo: d.tipoCodigo, cedula: d.cedula, descripcion: d.descripcion });

const crearConItems = (tipoCodigo, categoria) => (d) =>
  crear({ tipoCodigo, cedula: d.cedula, descripcion: d.observaciones }, async (id, tx) => {
    const insertados = await repo.insertItems(id, categoria, d.items, tx);
    if (insertados !== d.items.length) throw badRequest('Uno o más artículos no están disponibles');
  });

export const crearPapeleria = crearConItems('PAPELERIA', 'PAPELERIA');
export const crearInsumos = crearConItems('INSUMOS_SIST', 'INSUMO_SIST');

export const crearDesarrollo = (d) =>
  crear({ tipoCodigo: 'DESARROLLO', cedula: d.cedula, descripcion: d.descripcion }, async (id, tx) => {
    const tipoSoporteId = await repo.findTipoSoporteId('Desarrollo de aplicaciones', tx);
    if (!tipoSoporteId) throw badRequest('Falta el tipo de soporte "Desarrollo de aplicaciones" en el catálogo');
    await repo.insertSoporte(id, tipoSoporteId, d.motivo, tx);
  });

export const crearSoporte = (d, adjuntoUrl) =>
  crear({ tipoCodigo: 'SOPORTE', cedula: d.cedula, descripcion: d.descripcion, adjuntoUrl },
    (id, tx) => repo.insertSoporte(id, d.tipoSoporteId, null, tx));

export const crearUsuario = (d) =>
  crear({ tipoCodigo: 'USUARIO', cedula: d.cedula, descripcion: `${d.accion}: ${d.nombreUsuario}` },
    (id, tx) => repo.insertUsuario(id, d, tx));


export async function obtener(id) {
  const s = await repo.findById(id);
  if (!s) throw notFound('La solicitud no existe');
  return s;
}

export async function cambiarEstado(id, { estado, respuesta }) {
  const s = await repo.updateEstado(id, estado, respuesta);
  if (!s) throw notFound('La solicitud no existe');
  return s;
}
