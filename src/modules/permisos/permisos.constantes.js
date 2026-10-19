/*
 * Valores que se guardan en amapolanet.permisos, iguales a los de la Intrapola actual
 * (ddlTipoPermiso y ddlMedida), para que los reportes existentes sigan funcionando.
 * ⚠ Confirmar que coinciden exactamente con los Value de los DropDownList del .aspx.
 */
export const TIPOS_PERMISO = ['Permiso Remunerado', 'Permiso No Remunerado'];
export const MEDIDAS = ['Horas', 'Dias'];

/** "3" + "Horas" → "3 horas", "1" + "Dias" → "1 día" */
export function duracionTexto(tiempo, medida) {
  const n = Number(tiempo);
  const m = String(medida || '').toLowerCase().startsWith('d') ? (n === 1 ? 'día' : 'días') : (n === 1 ? 'hora' : 'horas');
  return `${n} ${m}`;
}
