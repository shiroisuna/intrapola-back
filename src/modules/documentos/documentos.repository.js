import { pendiente } from '../../utils/http.js';

/*
 * ⚠ Pendiente: no hay tabla de normas ni formatos en amapolanet ni en CAA
 * (en la Intrapola actual son archivos enlazados en las páginas .aspx).
 * Por definir: una tabla pequeña en CAA o leer la carpeta del IIS.
 * porCategoria debe devolver: [{ id, titulo, descripcion, archivoUrl, publicadoEn }]
 */
// eslint-disable-next-line no-unused-vars
export async function porCategoria(categoria) {
  throw pendiente(categoria === 'NORMA' ? 'Normas' : 'Formatos');
}

// eslint-disable-next-line no-unused-vars
export async function crear(datos) {
  throw pendiente('Publicación de documentos');
}
