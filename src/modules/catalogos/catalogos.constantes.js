/*
 * Catálogos que en la Intrapola actual estaban fijos en las páginas .aspx.
 * "valor" es el texto EXACTO que se guarda en las tablas viejas, para mantener compatibilidad
 * con los reportes existentes. "codigo" es lo que usa la API nueva.
 */

/** Tipos de RRHH: viven en el módulo rrhh (ahí se guardan). */
export { TIPOS_RRHH } from '../rrhh/rrhh.constantes.js';

/**
 * Accesos de la solicitud de usuarios.
 *  COMUNICACION → amapolanet.sol_necesidades_usuarios.necesidad
 *  SISTEMA      → por definir al adaptar el formulario (sol_intranet_sap / sol_intranet_spi / sol_accesos)
 */
export const ACCESOS = [
  { grupo: 'COMUNICACION', nombre: 'Correo externo', valor: 'Correo Externo' },
  { grupo: 'COMUNICACION', nombre: 'Internet libre', valor: 'Internet Libre' },
  { grupo: 'COMUNICACION', nombre: 'Teléfono corporativo', valor: 'Telefono Corporativo' },
  { grupo: 'COMUNICACION', nombre: 'Extensión telefónica', valor: 'Extension Telefonica' },
  ...['SAP', 'SPI', 'SAT', 'SISLOG', 'SGD', 'SCP', 'VISITAPOLA', 'CPE'].map((s) => ({ grupo: 'SISTEMA', nombre: s, valor: s })),
].map((a, i) => ({ id: i + 1, ...a }));
