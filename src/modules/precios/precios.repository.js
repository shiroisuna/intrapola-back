import { pendiente } from '../../utils/http.js';

/*
 * ⚠ Pendiente: no hay tabla de lista de precios en amapolanet ni en CAA.
 * Debe devolver: [{ codigo, descripcion, marca, presentacion, precio, moneda }]
 */
export async function vigentes() {
  throw pendiente('Lista de precios');
}
