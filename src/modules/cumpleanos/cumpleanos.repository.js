import { spi } from '../../config/db.js';

/*
 * Cumpleañeros: SPI (Oracle), misma lógica que cargar_cumple() de la Intrapola actual.
 *   eo_persona  (id, nombre1, apellido1, fecha_na)
 *   eoempleado  (id_persona, fecha_fin)  → fecha_fin IS NULL = trabajador activo
 * El departamento se completa con EMPLEADOS_AMAPOLA (id_persona → nombre).
 *
 * Diferencia con el C#: en vez de comparar texto (substr(fecha_na,4,3) = 'APR'), que depende
 * del idioma/formato de fecha del servidor, se usa EXTRACT(MONTH/DAY) sobre la fecha.
 */
export async function delMes(mes) {
  const filas = await spi.query(
    `SELECT TRIM(p.nombre1)                AS NOMBRES,
            TRIM(p.apellido1)              AS APELLIDOS,
            EXTRACT(DAY FROM p.fecha_na)   AS DIA,
            MAX(TRIM(ea.nombre))           AS DEPARTAMENTO
     FROM eo_persona p
     JOIN eoempleado e
       ON e.id_persona = p.id AND e.fecha_fin IS NULL
     LEFT JOIN EMPLEADOS_AMAPOLA ea
       ON ea.id_persona = p.id
     WHERE p.fecha_na IS NOT NULL
       AND EXTRACT(MONTH FROM p.fecha_na) = :mes
     GROUP BY p.id, TRIM(p.nombre1), TRIM(p.apellido1), EXTRACT(DAY FROM p.fecha_na)
     ORDER BY DIA, NOMBRES`,
    { mes: Number(mes) },
  );
  return filas.map((f) => ({
    nombres: f.NOMBRES ?? '',
    apellidos: f.APELLIDOS ?? '',
    departamento: f.DEPARTAMENTO || null,
    dia: Number(f.DIA),
  }));
}
