/*
 * Opciones de usuarios.aspx. "valor" es el texto EXACTO que se guarda en las tablas.
 *   SAP  → amapolanet.sol_intranet_sap.modulos
 *   SPI  → amapolanet.sol_intranet_spi.modulos
 *   COMUNICACION → amapolanet.sol_necesidades_usuarios.necesidad
 *   OTROS sistemas (SAT, SISLOG, ...) → la Intrapola actual no los guarda; solo salen en la hoja PDF.
 */
export const MODULOS_SAP = ['FI', 'MM', 'SD', 'QM', 'PP', 'PM'].map((m) => ({ codigo: m, nombre: `Módulo ${m}`, valor: `Modulo ${m}` }));

export const MODULOS_SPI = [
  { codigo: 'NOMINA', nombre: 'Nómina', valor: 'Nomina' },
  { codigo: 'ESTRUCTURA', nombre: 'Estructura organizacional', valor: 'Estructura Organizacional' },
  { codigo: 'TALENTO', nombre: 'SPI Talento', valor: 'SPI Talento' },
  { codigo: 'SEGURIDAD', nombre: 'Seguridad', valor: 'Seguridad' },
];

export const COMUNICACION = [
  { grupo: 'Correo', opciones: [
    { codigo: 'CORREO_INTERNO', nombre: 'Correo interno', valor: 'Correo Interno' },
    { codigo: 'CORREO_EXTERNO', nombre: 'Correo externo', valor: 'Correo Externo' },
  ] },
  { grupo: 'Teléfono', opciones: [
    { codigo: 'EXTENSION', nombre: 'Extensión telefónica', valor: 'Extension Telefonica' },
    { codigo: 'TELEFONO_CORP', nombre: 'Teléfono corporativo', valor: 'Telefono Corporativo' },
  ] },
  { grupo: 'Internet', opciones: [
    { codigo: 'INTERNET_LIMITADO', nombre: 'Internet limitado', valor: 'Internet Limitado' },
    { codigo: 'INTERNET_LIBRE', nombre: 'Internet libre', valor: 'Internet Libre' },
  ] },
];

export const OTROS_SISTEMAS = ['SAT', 'SISLOG', 'SGD', 'SCP', 'VISITAPOLA', 'CPE'];

const porCodigo = (lista) => Object.fromEntries(lista.map((x) => [x.codigo, x]));
export const SAP = porCodigo(MODULOS_SAP);
export const SPI = porCodigo(MODULOS_SPI);
export const NECESIDADES = porCodigo(COMUNICACION.flatMap((g) => g.opciones));
export const NECESIDAD_POR_VALOR = Object.fromEntries(COMUNICACION.flatMap((g) => g.opciones).map((o) => [o.valor, o]));

/** Para el frontend (sin los textos internos). */
export const opciones = () => ({
  sap: MODULOS_SAP.map(({ codigo, nombre }) => ({ codigo, nombre })),
  spi: MODULOS_SPI.map(({ codigo, nombre }) => ({ codigo, nombre })),
  comunicacion: COMUNICACION.map((g) => ({ grupo: g.grupo, opciones: g.opciones.map(({ codigo, nombre }) => ({ codigo, nombre })) })),
  otrosSistemas: OTROS_SISTEMAS,
});
