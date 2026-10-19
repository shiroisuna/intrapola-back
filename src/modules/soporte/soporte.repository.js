import { caa, sql } from '../../config/db.js';

/*
 * Soporte de sistemas — mismas tablas que ssoportesist.aspx (CAA):
 *   tipo_soporte            (idtipo, tipost, estadost)
 *   intrapola_ssoporte_sist (id_st, fecha_st, dptm_st, usuario_st = "NOMBRE-APELLIDO",
 *                            tipo_st = texto del tipo, descrip_st, estado_st)
 */

export async function tipoPorId(id) {
  const [t] = await caa.query(
    `SELECT CAST(idtipo AS INT) AS id, LTRIM(RTRIM(tipost)) AS nombre FROM dbo.tipo_soporte WHERE idtipo = @id AND estadost = 1`,
    { id: [sql.Int, id] },
  );
  return t ?? null;
}

/** Inserta y devuelve el número (id_st). Si la columna no es IDENTITY, toma el último del usuario como hacía mostrarssp(). */
export async function insertar(s) {
  const [f] = await caa.query(
    `INSERT INTO dbo.intrapola_ssoporte_sist (fecha_st, dptm_st, usuario_st, tipo_st, descrip_st, estado_st)
     VALUES (GETDATE(), @dpto, @usuario, @tipo, @descripcion, 'PENDIENTE');
     SELECT COALESCE(CAST(SCOPE_IDENTITY() AS INT),
                     (SELECT MAX(id_st) FROM dbo.intrapola_ssoporte_sist WHERE usuario_st = @usuario)) AS id;`,
    {
      dpto: [sql.NVarChar(150), s.departamento],
      usuario: [sql.NVarChar(150), s.usuario],
      tipo: [sql.NVarChar(100), s.tipo],
      descripcion: [sql.NVarChar(sql.MAX), s.descripcion],
    },
  );
  return f?.id ?? null;
}

/** La tabla guarda el nombre, no la cédula: se busca por "NOMBRE-APELLIDO". */
export function historial(usuario, limite) {
  return caa.query(
    `SELECT TOP (@limite) id_st AS id, CONVERT(VARCHAR(19), fecha_st, 126) AS fecha,
            LTRIM(RTRIM(tipo_st)) AS tipo, RTRIM(descrip_st) AS descripcion, UPPER(RTRIM(estado_st)) AS estado
     FROM dbo.intrapola_ssoporte_sist
     WHERE RTRIM(usuario_st) = @usuario
     ORDER BY fecha_st DESC`,
    { limite: [sql.Int, limite], usuario: [sql.NVarChar(150), usuario] },
  );
}
