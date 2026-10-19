/** Reglas del anticipo de prestaciones (portal_solic.aspx / solic_antic_prest.aspx). */

/** Solo se puede solicitar del día 1 al 10 de cada mes (validarfecha). */
export const DIA_LIMITE = 10;

/** Meses en que los trabajadores que ingresaron después de 2012 pueden solicitar sin cumplir el trimestre. */
export const MESES_CIERRE_TRIMESTRE = [3, 6, 9, 12];
export const ANIO_CORTE_INGRESO = 2012;

/** Planilla según la nómina del SPI: 0003 = empleados, el resto = obreros. */
export const archivoPlanilla = (idNomina) => (idNomina === '0003' ? 'EMPLEADOS.pdf' : 'OBREROS.pdf');
export const tipoNomina = (idNomina) => (idNomina === '0003' ? 'EMPLEADO' : 'OBRERO');

/** Duración de la sesión del portal. */
export const MINUTOS_SESION = 30;
