import { amapolanet, sql } from '../../config/db.js';

const { query } = amapolanet; // BD amapolanet

/*
 * Directorio: amapolanet.extenciones
 *   (id_ext, departamento_ext, nombre_ext, usuario_st, numero_ext, correo_ext, asterisco_ext, estado_ext)
 * estado_ext: 1 = activo, 0 = inactivo.
 * ⚠ Por confirmar: estado_ext 2 y 3 (6 registros cada uno) parecen ser los "Números de emergencia"
 *   y los "Proveedores de servicios" de la Intrapola actual. Ajustar ESTADOS si no es así.
 */
const ESTADOS = { extension: 1, emergencia: 2, proveedor: 3 };

const CAMPOS = `
  id_ext                                   AS id,
  LTRIM(RTRIM(departamento_ext))           AS departamento,
  LTRIM(RTRIM(nombre_ext))                 AS nombre,
  CAST(numero_ext AS VARCHAR(20))          AS extension,
  NULLIF(LTRIM(RTRIM(correo_ext)), '')     AS correo,
  NULLIF(LTRIM(RTRIM(asterisco_ext)), '')  AS asterisco,
  CAST(CASE WHEN NULLIF(LTRIM(RTRIM(usuario_st)), '') IS NULL THEN 0 ELSE 1 END AS BIT) AS esPersona`;

export const extensiones = () => query(
  `SELECT ${CAMPOS}, CAST(NULL AS NVARCHAR(1)) AS cargo
   FROM dbo.extenciones
   WHERE estado_ext = @estado
   ORDER BY LTRIM(RTRIM(departamento_ext)), LTRIM(RTRIM(nombre_ext))`,
  { estado: [sql.Int, ESTADOS.extension] },
);

/** Emergencias o proveedores, con la misma forma que espera el frontend (nombre, servicio, telefono). */
export async function contactos(tipo) {
  const filas = await query(
    `SELECT ${CAMPOS} FROM dbo.extenciones WHERE estado_ext = @estado ORDER BY LTRIM(RTRIM(nombre_ext))`,
    { estado: [sql.Int, tipo === 'EMERGENCIA' ? ESTADOS.emergencia : ESTADOS.proveedor] },
  );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    servicio: f.departamento,
    telefono: f.asterisco || f.extension, // números largos no caben en numero_ext (int)
    correo: f.correo,
  }));
}
