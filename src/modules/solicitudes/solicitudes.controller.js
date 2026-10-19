import * as service from './solicitudes.service.js';
import { misSolicitudes } from './solicitudes.historial.js';
import { pendiente } from '../../utils/http.js';
import { publicUrl } from '../../middlewares/upload.js';

const creado = (fn) => async (req, res) => res.status(201).json(await fn(req.body));

export const crearPermiso = creado(service.crearPermiso);
export const crearRrhh = creado(service.crearRrhh);
export const crearPapeleria = creado(service.crearPapeleria);
export const crearInsumos = creado(service.crearInsumos);
export const crearDesarrollo = creado(service.crearDesarrollo);
export const crearUsuario = creado(service.crearUsuario);

export async function crearSoporte(req, res) {
  res.status(201).json(await service.crearSoporte(req.body, publicUrl('soporte', req.file)));
}

/** GET /api/solicitudes?cedula=&limite= → { solicitudes, avisos } desde las tablas reales. */
export async function listar(req, res) {
  res.json(await misSolicitudes(req.validQuery));
}

// Detalle y cambio de estado dependían de la BD nueva (vw_solicitudes); vuelven con la bandeja de gestión.
export async function obtener() { throw pendiente('Detalle de solicitudes'); }
export async function cambiarEstado() { throw pendiente('Gestión de solicitudes'); }
