import { amapolanet, sql } from '../../config/db.js';

/*
 * amapolanet.solrrhh — mismo INSERT que Button2_Click de solrrhh.aspx:
 *   nrosolrrhh, fechasolrrhh, tiposopsolrrhh, deptmsolrrhh, cargosolrrhh, cedulasolrrhh,
 *   nombresolrrhh (primer nombre), apellidosolrrhh (primer apellido), observsolrrhh, estadosolrrhh
 * Funciona si nrosolrrhh es IDENTITY o si hay que calcularlo.
 */
export async function insertar(s) {
  const [fila] = await amapolanet.query(
    `SET XACT_ABORT ON;
     BEGIN TRAN;
     DECLARE @id INT;
     IF COLUMNPROPERTY(OBJECT_ID('dbo.solrrhh'), 'nrosolrrhh', 'IsIdentity') = 1
     BEGIN
       INSERT INTO dbo.solrrhh (fechasolrrhh, tiposopsolrrhh, deptmsolrrhh, cargosolrrhh, cedulasolrrhh,
                                nombresolrrhh, apellidosolrrhh, observsolrrhh, estadosolrrhh)
       VALUES (GETDATE(), @tipo, @dpto, @cargo, @cedula, @nombre, @apellido, @obs, 'PENDIENTE');
       SET @id = SCOPE_IDENTITY();
     END
     ELSE
     BEGIN
       SELECT @id = ISNULL(MAX(nrosolrrhh), 0) + 1 FROM dbo.solrrhh WITH (UPDLOCK, HOLDLOCK);
       EXEC sp_executesql
         N'INSERT INTO dbo.solrrhh (nrosolrrhh, fechasolrrhh, tiposopsolrrhh, deptmsolrrhh, cargosolrrhh, cedulasolrrhh,
                                    nombresolrrhh, apellidosolrrhh, observsolrrhh, estadosolrrhh)
           VALUES (@id, GETDATE(), @tipo, @dpto, @cargo, @cedula, @nombre, @apellido, @obs, ''PENDIENTE'')',
         N'@id INT, @tipo NVARCHAR(100), @dpto NVARCHAR(150), @cargo NVARCHAR(150), @cedula NVARCHAR(20),
           @nombre NVARCHAR(100), @apellido NVARCHAR(100), @obs NVARCHAR(MAX)',
         @id, @tipo, @dpto, @cargo, @cedula, @nombre, @apellido, @obs;
     END
     COMMIT;
     SELECT @id AS id;`,
    {
      tipo: [sql.NVarChar(100), s.tipo],
      dpto: [sql.NVarChar(150), s.departamento],
      cargo: [sql.NVarChar(150), s.cargo],
      cedula: [sql.NVarChar(20), s.cedula],
      nombre: [sql.NVarChar(100), s.nombre],
      apellido: [sql.NVarChar(100), s.apellido],
      obs: [sql.NVarChar(sql.MAX), s.observacion],
    },
  );
  return fila.id;
}

/** Últimas solicitudes a RRHH de un trabajador. */
export function historial(cedula, limite) {
  return amapolanet.query(
    `SELECT TOP (@limite) nrosolrrhh AS id,
            CONVERT(VARCHAR(19), fechasolrrhh, 126) AS fecha,
            RTRIM(tiposopsolrrhh) AS tipo,
            RTRIM(observsolrrhh)  AS observacion,
            UPPER(RTRIM(estadosolrrhh)) AS estado
     FROM dbo.solrrhh
     WHERE RTRIM(cedulasolrrhh) = @cedula
     ORDER BY fechasolrrhh DESC`,
    { limite: [sql.Int, limite], cedula: [sql.NVarChar(20), cedula] },
  );
}
