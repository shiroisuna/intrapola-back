import * as repo from './empleados.repository.js';
import { notFound } from '../../utils/http.js';

export async function obtenerPorCedula(req, res) {
  const empleado = await repo.findByCedula(req.params.cedula);
  if (!empleado) throw notFound('No hay un trabajador activo con esa cédula');
  res.json(empleado);
}

export async function buscar(req, res) {
  const { q, departamento } = req.validQuery;
  res.json(departamento ? await repo.porDepartamento(departamento) : await repo.search(q));
}
