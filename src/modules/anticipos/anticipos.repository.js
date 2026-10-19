import { amapolanet, caa, asistencia, sql } from '../../config/db.js';

/*
 * Tablas del anticipo de prestaciones:
 *   amapolanet.users     (id_usuario, login_cedula, clave, estado_usuario)   → acceso al portal
 *   amapolanet.UserData  (id_usuario, nombre, apellido, correo, departamento, cargo, tipo_nomina)
 *   CAA.SAT_rrhh_solicitudes_anticipo (cedula, correo, monto, fecha)
 *   Asistencia-Amapola.USERINFO (CardNo = cédula, HIREDDAY)
 *
 * Las claves se siguen guardando y comparando igual que en la Intrapola actual, porque las dos
 * aplicaciones comparten la tabla mientras conviven. Pero ahora van como parámetros (el C# las
 * concatenaba en el SQL).
 */

const ced = (c) => [sql.NVarChar(20), String(c).trim()];

export async function buscarUsuario(cedula, clave) {
  const [u] = await amapolanet.query(
    `SELECT TOP 1 RTRIM(u.login_cedula) AS cedula, RTRIM(ud.nombre) AS nombre, RTRIM(ud.apellido) AS apellido,
            RTRIM(ud.correo) AS correo, RTRIM(ud.tipo_nomina) AS tipoNomina
     FROM dbo.users u
     INNER JOIN dbo.UserData ud ON ud.id_usuario = u.id_usuario
     WHERE RTRIM(u.login_cedula) = @cedula AND u.clave = @clave`,
    { cedula: ced(cedula), clave: [sql.NVarChar(100), clave] },
  );
  return u ?? null;
}

export async function existeUsuario(cedula) {
  const [f] = await amapolanet.query(
    `SELECT COUNT(*) AS n FROM dbo.users WHERE RTRIM(login_cedula) = @cedula`,
    { cedula: ced(cedula) },
  );
  return f.n > 0;
}

/** Mismo registro que btnRegister_Click, en una transacción. */
export function registrarUsuario(d) {
  return amapolanet.withTransaction(async (tx) => {
    const [u] = await amapolanet.query(
      `INSERT INTO dbo.users (login_cedula, clave, estado_usuario) OUTPUT INSERTED.id_usuario AS id VALUES (@cedula, @clave, '1')`,
      { cedula: ced(d.cedula), clave: [sql.NVarChar(100), d.clave] }, tx,
    );
    await amapolanet.query(
      `INSERT INTO dbo.UserData (id_usuario, nombre, apellido, correo, departamento, cargo, tipo_nomina)
       VALUES (@id, @nombre, @apellido, @correo, @departamento, @cargo, @nomina)`,
      {
        id: [sql.Int, u.id],
        nombre: [sql.NVarChar(100), d.nombre],
        apellido: [sql.NVarChar(100), d.apellido],
        correo: [sql.NVarChar(150), d.correo],
        departamento: [sql.NVarChar(150), d.departamento],
        cargo: [sql.NVarChar(150), d.cargo],
        nomina: [sql.NVarChar(20), d.tipoNomina],
      }, tx,
    );
    return u.id;
  });
}

export async function contarSolicitudes(cedula) {
  const [f] = await caa.query(
    `SELECT COUNT(*) AS n FROM dbo.SAT_rrhh_solicitudes_anticipo WHERE RTRIM(cedula) = @cedula`,
    { cedula: ced(cedula) },
  );
  return f.n;
}

/** Meses desde el ingreso hasta el mes pasado y año de ingreso, según el reloj de asistencia. */
export async function ingresoAsistencia(cedula) {
  const [f] = await asistencia.query(
    `SELECT TOP 1 DATEDIFF(MONTH, HIREDDAY, DATEADD(MONTH, -1, GETDATE())) AS meses, YEAR(HIREDDAY) AS anioIngreso
     FROM dbo.USERINFO WHERE RTRIM(CardNo) = @cedula`,
    { cedula: ced(cedula) },
  );
  return f ?? null;
}

export function insertarSolicitud({ cedula, correo, monto }) {
  return caa.query(
    `INSERT INTO dbo.SAT_rrhh_solicitudes_anticipo (cedula, correo, monto, fecha)
     OUTPUT CONVERT(VARCHAR(19), inserted.fecha, 126) AS fecha
     VALUES (@cedula, @correo, @monto, GETDATE())`,
    { cedula: ced(cedula), correo: [sql.NVarChar(150), correo], monto: [sql.NVarChar(30), monto] },
  );
}

export function historial(cedula, limite) {
  return caa.query(
    `SELECT TOP (@limite) CONVERT(VARCHAR(19), fecha, 126) AS fecha, monto
     FROM dbo.SAT_rrhh_solicitudes_anticipo
     WHERE RTRIM(cedula) = @cedula ORDER BY fecha DESC`,
    { limite: [sql.Int, limite], cedula: ced(cedula) },
  );
}
