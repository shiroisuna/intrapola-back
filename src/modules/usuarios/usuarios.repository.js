import { amapolanet, sql } from '../../config/db.js';

/*
 * Solicitud de usuarios — mismas tablas que usuarios.aspx (amapolanet):
 *   solicitudes_usuarios     (id_solicitud, usuario, cargo, solicitante = "NOMBRE-APELLIDO", dpto, fecha = 'dd/MM/yyyy', estado = '1')
 *   sol_intranet_sap         (id_sol_sap, id_solicitud_usuario, modulos, estado)
 *   sol_intranet_spi         (id_sol_spi, id_usuario_sol, modulos, estado)
 *   sol_necesidades_usuarios (id_necesidad, id_usuario, necesidad, estado)
 * Todo en una transacción (en el C# cada INSERT iba por separado).
 */
/**
 * El C# mandaba la fecha como texto 'dd/MM/yyyy'. Si la columna es de tipo fecha y el idioma del login
 * es inglés (mdy), SQL Server lee 19/10/2026 como mes 19 y falla. Se convierte explícitamente con estilo 103.
 */
let esFecha;
async function columnaFechaEsFecha() {
  if (esFecha === undefined) {
    const [c] = await amapolanet.query(
      `SELECT t.name AS tipo FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
       WHERE c.object_id = OBJECT_ID('dbo.solicitudes_usuarios') AND c.name = 'fecha'`,
    );
    esFecha = /date|time/i.test(c?.tipo ?? '');
  }
  return esFecha;
}

export async function crear({ usuario, cargo, solicitante, departamento, fecha, sap, spi, necesidades }) {
  const valorFecha = (await columnaFechaEsFecha()) ? 'CONVERT(DATETIME, @fecha, 103)' : '@fecha';
  return amapolanet.withTransaction(async (tx) => {
    const [cab] = await amapolanet.query(
      `INSERT INTO dbo.solicitudes_usuarios (usuario, cargo, solicitante, dpto, fecha, estado)
       OUTPUT INSERTED.id_solicitud AS id
       VALUES (@usuario, @cargo, @solicitante, @dpto, ${valorFecha}, '1')`,
      {
        usuario: [sql.NVarChar(150), usuario],
        cargo: [sql.NVarChar(150), cargo],
        solicitante: [sql.NVarChar(150), solicitante],
        dpto: [sql.NVarChar(150), departamento],
        fecha: [sql.NVarChar(10), fecha], // dd/MM/yyyy, igual que el C#
      }, tx,
    );
    const id = cab.id;
    const p = (valor) => ({ id: [sql.Int, id], v: [sql.NVarChar(100), valor] });
    for (const v of sap) {
      await amapolanet.query(`INSERT INTO dbo.sol_intranet_sap (id_solicitud_usuario, modulos, estado) VALUES (@id, @v, '1')`, p(v), tx);
    }
    for (const v of spi) {
      await amapolanet.query(`INSERT INTO dbo.sol_intranet_spi (id_usuario_sol, modulos, estado) VALUES (@id, @v, '1')`, p(v), tx);
    }
    for (const v of necesidades) {
      await amapolanet.query(`INSERT INTO dbo.sol_necesidades_usuarios (id_usuario, necesidad, estado) VALUES (@id, @v, '1')`, p(v), tx);
    }
    return id;
  });
}

export async function obtener(id) {
  const p = { id: [sql.Int, id] };
  const [cab] = await amapolanet.query(
    `SELECT id_solicitud AS id, RTRIM(usuario) AS usuario, RTRIM(cargo) AS cargo, RTRIM(solicitante) AS solicitante,
            RTRIM(dpto) AS departamento, RTRIM(CONVERT(VARCHAR(30), fecha, 103)) AS fecha
     FROM dbo.solicitudes_usuarios WHERE id_solicitud = @id`, p);
  if (!cab) return null;
  const [sap, spi, nec] = await Promise.all([
    amapolanet.query(`SELECT RTRIM(modulos) AS v FROM dbo.sol_intranet_sap WHERE id_solicitud_usuario = @id`, p),
    amapolanet.query(`SELECT RTRIM(modulos) AS v FROM dbo.sol_intranet_spi WHERE id_usuario_sol = @id`, p),
    amapolanet.query(`SELECT RTRIM(necesidad) AS v FROM dbo.sol_necesidades_usuarios WHERE id_usuario = @id`, p),
  ]);
  return { ...cab, sap: sap.map((r) => r.v), spi: spi.map((r) => r.v), necesidades: nec.map((r) => r.v) };
}

/** Solicitudes hechas por un solicitante ("NOMBRE-APELLIDO"). */
export function historial(solicitante, limite) {
  return amapolanet.query(
    `SELECT TOP (@limite) id_solicitud AS id, RTRIM(usuario) AS usuario, RTRIM(cargo) AS cargo,
            RTRIM(CONVERT(VARCHAR(30), fecha, 103)) AS fecha
     FROM dbo.solicitudes_usuarios
     WHERE RTRIM(solicitante) = @solicitante
     ORDER BY id_solicitud DESC`,
    { limite: [sql.Int, limite], solicitante: [sql.NVarChar(150), solicitante] },
  );
}
