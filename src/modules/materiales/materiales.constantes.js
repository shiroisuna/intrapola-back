/*
 * Opciones de crmddemat_sap.aspx. "valor" es lo que se guarda en CAA.intrapola_cme_material.
 *   solicitud_mat ← DropDownList1.SelectedValue  (el texto se usa en el asunto: "<texto> de Material")
 *   exite_mat     ← DropDownList2.SelectedValue  (la segunda opción deshabilita el código y pone "S/C")
 */
export const TIPOS = [
  { valor: 'CREACION', texto: 'Creación' },
  { valor: 'MODIFICACION', texto: 'Modificación' },
  { valor: 'DESINCORPORACION', texto: 'Desincorporación' },
];

export const VERIFICACION = [
  { valor: 'SI EXISTE', texto: 'Sí existe en SAP', conCodigo: true },
  { valor: 'NO EXISTE', texto: 'No existe en SAP', conCodigo: false },
];

/** estado_mat: el C# guarda '0' al crear; la aprobación la hace form_modcrmddemat.aspx. */
export const ESTADOS = { 0: 'PENDIENTE', 1: 'APROBADA', 2: 'RECHAZADA' };
