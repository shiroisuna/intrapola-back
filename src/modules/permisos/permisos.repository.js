import { amapolanet, sql } from '../../config/db.js';

/*
 * amapolanet.permisos
 *   idpermiso, fecha_permiso (datetime), nombre_permiso (nombre y apellido),
 *   para_permiso (ficha del trabajador), motivo_permiso, tipo_permiso,
 *   tiempo_permiso (int), medida_permiso
 * Mismo INSERT que btnGuardarPermiso_Click. La tabla no guarda cédula ni observaciones.
 */

/** Inserta y devuelve el id. Funciona si idpermiso es IDENTITY o si hay que calcularlo. */
export async function insertar(p) {
  const [fila] = await amapolanet.query(
    `SET XACT_ABORT ON;
     BEGIN TRAN;
     DECLARE @id INT;
     IF COLUMNPROPERTY(OBJECT_ID('dbo.permisos'), 'idpermiso', 'IsIdentity') = 1
     BEGIN
       INSERT INTO dbo.permisos (fecha_permiso, nombre_permiso, para_permiso, motivo_permiso, tipo_permiso, tiempo_permiso, medida_permiso)
       VALUES (@fecha, @nombre, @para, @motivo, @tipo, @tiempo, @medida);
       SET @id = SCOPE_IDENTITY();
     END
     ELSE
     BEGIN
       SELECT @id = ISNULL(MAX(idpermiso), 0) + 1 FROM dbo.permisos WITH (UPDLOCK, HOLDLOCK);
       EXEC sp_executesql
         N'INSERT INTO dbo.permisos (idpermiso, fecha_permiso, nombre_permiso, para_permiso, motivo_permiso, tipo_permiso, tiempo_permiso, medida_permiso)
           VALUES (@id, @fecha, @nombre, @para, @motivo, @tipo, @tiempo, @medida)',
         N'@id INT, @fecha DATE, @nombre NVARCHAR(150), @para NVARCHAR(150), @motivo NVARCHAR(200), @tipo NVARCHAR(90), @tiempo INT, @medida NVARCHAR(10)',
         @id, @fecha, @nombre, @para, @motivo, @tipo, @tiempo, @medida;
     END
     COMMIT;
     SELECT @id AS id;`,
    {
      fecha: [sql.Date, p.fechaPermiso],
      nombre: [sql.NVarChar(150), p.nombre],
      para: [sql.NVarChar(150), p.ficha],
      motivo: [sql.NVarChar(200), p.motivo],
      tipo: [sql.NVarChar(90), p.tipoPermiso],
      tiempo: [sql.Int, p.tiempo],
      medida: [sql.NVarChar(10), p.medida],
    },
  );
  return fila.id;
}

export async function obtener(id) {
  const [f] = await amapolanet.query(
    `SELECT idpermiso AS id,
            CONVERT(VARCHAR(10), fecha_permiso, 23) AS fechaPermiso,
            RTRIM(nombre_permiso) AS nombre,
            RTRIM(para_permiso)   AS ficha,
            RTRIM(motivo_permiso) AS motivo,
            RTRIM(tipo_permiso)   AS tipoPermiso,
            tiempo_permiso        AS tiempo,
            RTRIM(medida_permiso) AS medida
     FROM dbo.permisos WHERE idpermiso = @id`,
    { id: [sql.Int, id] },
  );
  return f ?? null;
}

/** Últimos permisos de un trabajador (la tabla los relaciona por ficha, no por cédula). */
export function historial(ficha, limite) {
  return amapolanet.query(
    `SELECT TOP (@limite) idpermiso AS id,
            CONVERT(VARCHAR(10), fecha_permiso, 23) AS fecha,
            RTRIM(motivo_permiso) AS motivo,
            RTRIM(tipo_permiso)   AS tipoPermiso,
            tiempo_permiso        AS tiempo,
            RTRIM(medida_permiso) AS medida
     FROM dbo.permisos
     WHERE RTRIM(para_permiso) = @ficha
     ORDER BY idpermiso DESC`,
    { limite: [sql.Int, limite], ficha: [sql.NVarChar(150), String(ficha).trim()] },
  );
}
