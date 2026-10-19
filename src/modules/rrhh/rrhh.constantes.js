/*
 * Tipos de solicitud a RRHH (DropDownList1 de solrrhh.aspx).
 *   valor      → texto EXACTO que se guarda en amapolanet.solrrhh.tiposopsolrrhh
 *   formulario → GENERAL se guarda aquí; los demás tienen su propio formulario, igual que en el C#,
 *                donde al elegirlos se redirigía (6 → svacaciones, 4 → portal_solic, 9 → usuarios).
 */
export const TIPOS_RRHH = [
  { codigo: 'RRHH_INFORMACION', nombre: 'Información', valor: 'Información' },
  { codigo: 'RRHH_RECLAMO', nombre: 'Reclamo', valor: 'Reclamos' },
  { codigo: 'RRHH_CONSTANCIA', nombre: 'Constancia de trabajo', valor: 'Solicitud de Constancia de Trabajo' },
  { codigo: 'RRHH_ANTICIPO', nombre: 'Anticipo de prestaciones', valor: 'Solicitud Anticipo de Prestaciones', formulario: 'ANTICIPO', ruta: '/solicitudes/anticipo' },
  { codigo: 'RRHH_FIDEICOMISO', nombre: 'Fideicomiso', valor: 'Solicitud de Fideicomiso' },
  { codigo: 'RRHH_TODOTICKET', nombre: 'Tarjeta TodoTicket', valor: 'Solicitud Tarjetas TodoTickets' },
  { codigo: 'RRHH_TRANSPORTE', nombre: 'Transporte', valor: 'Solicitud de Transporte' },
  { codigo: 'RRHH_VACACIONES', nombre: 'Vacaciones', valor: 'Solicitud de Vacaciones', formulario: 'VACACIONES', ruta: '/solicitudes/vacaciones' },
  { codigo: 'RRHH_PERMISOS', nombre: 'Permisos', valor: 'Solicitud de Permisos', formulario: 'PERMISO', ruta: '/solicitudes/permiso' },
  { codigo: 'RRHH_USUARIOS', nombre: 'Usuarios', valor: 'Solicitud de Usuarios', formulario: 'USUARIOS', ruta: '/solicitudes/usuarios' },
  { codigo: 'RRHH_ACTUALIZACION', nombre: 'Actualización de datos', valor: 'Actualizacion de Datos' },
  { codigo: 'RRHH_SUGERENCIA', nombre: 'Sugerencia', valor: 'Sugerencias' },
].map((t, i) => ({ id: i + 1, area: 'RRHH', formulario: 'GENERAL', ruta: null, ...t }));

export const tipoPorCodigo = (codigo) => TIPOS_RRHH.find((t) => t.codigo === codigo) ?? null;
export const tipoPorValor = (valor) => TIPOS_RRHH.find((t) => t.valor === valor) ?? null;
