import { spi } from '../../config/db.js';

/*
 * Trabajadores: SPI (Oracle) → EMPLEADOS_AMAPOLA
 *   cedula, nombre1, apellido1, nombre (= departamento), puesto (= cargo), ID_NOMINA
 * Mismas columnas que usa la Intrapola actual (ConsultaPorCedula en C#), pero con
 * parámetros enlazados en vez de concatenar texto en el SQL.
 */
const NOMINAS = { '0001': 'Confidencial', '0002': 'Contratado', '0003': 'Empleado', '0004': 'Obrero' };

// Solo columnas que la intranet necesita (no se leen SUELD1 ni CTAPAG).
const SELECT = `
  SELECT TRIM(cedula)                       AS CEDULA,
         TRIM(ficha)                        AS FICHA,
         TRIM(nombre1)                      AS NOMBRE1,
         TRIM(nombre2)                      AS NOMBRE2,
         TRIM(apellido1)                    AS APELLIDO1,
         TRIM(apellido2)                    AS APELLIDO2,
         TRIM(nombre)                       AS DEPARTAMENTO,
         TRIM(ID_UNIDAD)                    AS ID_UNIDAD,
         TRIM(puesto)                       AS CARGO,
         TRIM(ID_CARGO)                     AS ID_CARGO,
         TRIM(ID_NOMINA)                    AS ID_NOMINA,
         TO_CHAR(fecing, 'YYYY-MM-DD')      AS FECHA_INGRESO
  FROM EMPLEADOS_AMAPOLA`;

/** Fila de Oracle → forma que usa la API (igual a la de antes, para no tocar el frontend). */
function aEmpleado(f) {
  const nombres = f.NOMBRE1 ?? '';
  const apellidos = f.APELLIDO1 ?? '';
  return {
    cedula: f.CEDULA,
    ficha: f.FICHA || null,
    nombres,
    apellidos,
    nombreCompleto: `${nombres} ${apellidos}`.trim(),
    nombresCompletos: [f.NOMBRE1, f.NOMBRE2].filter(Boolean).join(' '),
    apellidosCompletos: [f.APELLIDO1, f.APELLIDO2].filter(Boolean).join(' '),
    departamento: f.DEPARTAMENTO || null,
    departamentoId: f.ID_UNIDAD || null,
    cargo: f.CARGO || null,
    idCargo: f.ID_CARGO || null,
    idNomina: f.ID_NOMINA || null,
    nomina: NOMINAS[f.ID_NOMINA] ?? null,
    fechaIngreso: f.FECHA_INGRESO || null,
  };
}

export async function findByCedula(cedula) {
  const filas = await spi.query(
    `${SELECT} WHERE TRIM(cedula) = :cedula AND ROWNUM = 1`,
    { cedula: String(cedula).trim() },
  );
  return filas[0] ? aEmpleado(filas[0]) : null;
}

/** Búsqueda por cédula (prefijo) o por nombre y apellido. */
export async function search(texto, limite = 20) {
  const filas = await spi.query(
    `SELECT * FROM (
       ${SELECT}
       WHERE TRIM(cedula) LIKE :t || '%'
          OR UPPER(TRIM(nombre1) || ' ' || TRIM(apellido1)) LIKE '%' || UPPER(:t) || '%'
       ORDER BY NOMBRE1, APELLIDO1
     ) WHERE ROWNUM <= :limite`,
    { t: String(texto).trim(), limite: Number(limite) },
  );
  return filas.map(aEmpleado);
}

/** Trabajadores de un departamento (equivale a la opción "Todos" del formulario viejo). */
export async function porDepartamento(departamento) {
  const filas = await spi.query(
    `${SELECT} WHERE TRIM(nombre) = :departamento ORDER BY nombre1, apellido1`,
    { departamento: String(departamento).trim() },
  );
  return filas.map(aEmpleado);
}

/** Trabajador por ficha (para reimprimir documentos que solo guardaron la ficha). */
export async function findByFicha(ficha) {
  const filas = await spi.query(
    `${SELECT} WHERE TRIM(ficha) = :ficha AND ROWNUM = 1`,
    { ficha: String(ficha).trim() },
  );
  return filas[0] ? aEmpleado(filas[0]) : null;
}

/** Correo personal registrado en el SPI (EO_PERSONA.E_MAIL1), como en portal_solic.aspx. */
export async function correoPorCedula(cedula) {
  const filas = await spi.query(
    `SELECT TRIM(b.E_MAIL1) AS CORREO
     FROM EMPLEADOS_AMAPOLA a INNER JOIN EO_PERSONA b ON b.ID = a.ID_PERSONA
     WHERE TRIM(a.CEDULA) = :cedula AND ROWNUM = 1`,
    { cedula: String(cedula).trim() },
  );
  return filas[0]?.CORREO || null;
}

/** "NOMBRE-APELLIDO": forma en que la Intrapola actual guarda al trabajador (nombre1 || '-' || apellido1). */
export const nombreLegacy = (e) => [e.nombres, e.apellidos].filter(Boolean).join('-').toUpperCase();
