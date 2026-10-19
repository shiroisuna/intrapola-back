import { amapolanet, caa, sql } from '../../config/db.js';

/*
 * Vacaciones — mismas fuentes que svacaciones.aspx:
 *   amapolanet.feriados (columna dias)            → feriados dentro del período
 *   CAA.sp_calculodiasvacaciones                  → fecha de reintegro (FECHAFINVACACIONES)
 *   CAA.SAT_vacaciones                            → registro de la solicitud
 */

/** Cantidad de feriados entre dos fechas (ambas incluidas). */
export async function contarFeriados(desde, hasta) {
  const [f] = await amapolanet.query(
    `SELECT COUNT(*) AS total FROM dbo.feriados WHERE dias BETWEEN @desde AND @hasta`,
    { desde: [sql.Date, desde], hasta: [sql.Date, hasta] },
  );
  return f.total;
}

/** Ejecuta el procedimiento que ya usa la Intrapola. Devuelve la primera fila. */
export async function calcularDias({ feriados, inicio, dias }) {
  const pool = await caa.getPool();
  const r = await pool.request()
    .input('Diasferiados', sql.Int, feriados)
    .input('FechaInicio', sql.DateTime, inicio)
    .input('NumeroDias', sql.Int, dias)
    .execute('dbo.sp_calculodiasvacaciones');
  return r.recordset?.[0] ?? null;
}

export function insertar(v) {
  return caa.query(
    `INSERT INTO dbo.SAT_vacaciones (cedula, cargo, antiguedad, periodo, fecha_sol, inicio, fin, dias, total, disfrutado)
     VALUES (@cedula, @cargo, @antiguedad, @periodo, @fechaSol, @inicio, @fin, @dias, @total, 'SI')`,
    {
      cedula: [sql.NVarChar(20), v.cedula],
      cargo: [sql.NVarChar(150), v.cargo],
      antiguedad: [sql.Int, v.antiguedad],
      periodo: [sql.NVarChar(50), v.periodo],
      fechaSol: [sql.Date, v.fechaSol],
      inicio: [sql.Date, v.inicio],
      fin: [sql.Date, v.fin],
      dias: [sql.Int, v.dias],
      total: [sql.Int, v.total],
    },
  );
}

const COLUMNAS = `RTRIM(cedula) AS cedula, RTRIM(cargo) AS cargo, antiguedad, RTRIM(periodo) AS periodo,
  CONVERT(VARCHAR(10), fecha_sol, 23) AS fechaSol, CONVERT(VARCHAR(10), inicio, 23) AS inicio,
  CONVERT(VARCHAR(10), fin, 23) AS fin, dias, total`;

/** La tabla no tiene un número propio conocido: se identifica por cédula + fecha de salida. */
export async function obtener(cedula, inicio) {
  const [f] = await caa.query(
    `SELECT TOP 1 ${COLUMNAS} FROM dbo.SAT_vacaciones
     WHERE RTRIM(cedula) = @cedula AND CONVERT(DATE, inicio) = @inicio
     ORDER BY fecha_sol DESC`,
    { cedula: [sql.NVarChar(20), cedula], inicio: [sql.Date, inicio] },
  );
  return f ?? null;
}

export function historial(cedula, limite) {
  return caa.query(
    `SELECT TOP (@limite) ${COLUMNAS} FROM dbo.SAT_vacaciones
     WHERE RTRIM(cedula) = @cedula ORDER BY fecha_sol DESC, inicio DESC`,
    { limite: [sql.Int, limite], cedula: [sql.NVarChar(20), cedula] },
  );
}
