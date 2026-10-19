import { amapolanet, sql } from '../../config/db.js';

/*
 * Solicitud de papelería — mismas tablas que spapeleria.aspx (amapolanet):
 *   parametros       (tipo_para = 'solped_pap', num_para = último número usado)
 *   solpedpapeleria  (numerosol, fechasol, deptmsol = CÉDULA, emplesol = "NOMBRE-APELLIDO",
 *                     cantdsol = cantidad de artículos distintos, dptosol = departamento)
 *   tarticulos       (numerosol_temp, idarticulo_temp, articulo_temp, cantd_temp, usuario_temp)
 *   articulos        (catálogo, estado = 1)
 *
 * Diferencias con el C#: todo va en UNA transacción, el número se reserva con un UPDATE atómico
 * (dos personas guardando a la vez no reciben el mismo número) y no se usa temp_articulos.
 */

/**
/**
 * Lista de artículos como tabla derivada con parámetros: (VALUES (@a0,@c0),(@a1,@c1)) AS j(a, c).
 * Se evita OPENJSON porque requiere nivel de compatibilidad 130+ y amapolanet está en uno menor.
 */
function tablaItems(items) {
  const params = {};
  const filas = items.map((it, i) => {
    params[`a${i}`] = [sql.BigInt, it.articuloId];
    params[`c${i}`] = [sql.Int, it.cantidad];
    return `(@a${i}, @c${i})`;
  });
  return { tabla: `(VALUES ${filas.join(', ')}) AS j(a, c)`, params };
}

/**
 * Guarda la solicitud completa. items: [{ articuloId, cantidad }]
 * Devuelve { numero, items: [{ articuloId, nombre, cantidad }] }
 */
export async function crear({ cedula, usuario, departamento, items }) {
  return amapolanet.withTransaction(async (tx) => {
    // 1. Validar artículos contra el catálogo (nombre real desde la BD, no desde el navegador)
    const { tabla, params } = tablaItems(items);
    const validos = await amapolanet.query(
      `SELECT j.a AS articuloId, RTRIM(ar.articulo) AS nombre, j.c AS cantidad
       FROM ${tabla}
       JOIN dbo.articulos ar ON ar.idarticulo = j.a AND ar.estado = 1`,
      params, tx,
    );
    if (validos.length !== items.length) {
      const err = new Error('Uno o más artículos ya no están disponibles. Actualice la página e intente de nuevo.');
      err.status = 400;
      throw err;
    }

    // 2. Reservar el número (atómico)
    const [param] = await amapolanet.query(
      `UPDATE dbo.parametros WITH (UPDLOCK, ROWLOCK)
       SET num_para = num_para + 1
       OUTPUT inserted.num_para AS numero
       WHERE tipo_para = 'solped_pap'`,
      {}, tx,
    );
    if (!param) throw new Error("No existe el parámetro 'solped_pap' en amapolanet.parametros");
    const numero = param.numero;

    // 3. Artículos
    await amapolanet.query(
      `INSERT INTO dbo.tarticulos (numerosol_temp, idarticulo_temp, articulo_temp, cantd_temp, usuario_temp)
       SELECT @numero, j.a, RTRIM(ar.articulo), j.c, @usuario
       FROM ${tabla}
       JOIN dbo.articulos ar ON ar.idarticulo = j.a`,
      { ...params, numero: [sql.Int, numero], usuario: [sql.NVarChar(100), usuario] }, tx,
    );

    // 4. Cabecera
    await amapolanet.query(
      `INSERT INTO dbo.solpedpapeleria (numerosol, fechasol, deptmsol, emplesol, cantdsol, dptosol)
       VALUES (@numero, GETDATE(), @cedula, @usuario, @cantidad, @departamento)`,
      {
        numero: [sql.Int, numero],
        cedula: [sql.NVarChar(100), cedula],
        usuario: [sql.NVarChar(100), usuario],
        cantidad: [sql.Int, items.length],
        departamento: [sql.NVarChar(100), departamento],
      }, tx,
    );

    return { numero, items: validos };
  });
}

/** Cabecera + artículos para la hoja PDF. */
export async function obtener(numero) {
  const p = { numero: [sql.Int, numero] };
  const [cab] = await amapolanet.query(
    `SELECT numerosol AS numero, CONVERT(VARCHAR(10), fechasol, 23) AS fecha,
            RTRIM(deptmsol) AS cedula, RTRIM(emplesol) AS usuario,
            cantdsol AS cantidad, RTRIM(dptosol) AS departamento
     FROM dbo.solpedpapeleria WHERE numerosol = @numero`,
    p,
  );
  if (!cab) return null;
  const items = await amapolanet.query(
    `SELECT idarticulo_temp AS articuloId, RTRIM(articulo_temp) AS nombre, cantd_temp AS cantidad
     FROM dbo.tarticulos WHERE numerosol_temp = @numero ORDER BY RTRIM(articulo_temp)`,
    p,
  );
  return { ...cab, items };
}

/** Últimas solicitudes de papelería de un trabajador (deptmsol guarda la cédula). */
export function historial(cedula, limite) {
  return amapolanet.query(
    `SELECT TOP (@limite) s.numerosol AS numero,
            CONVERT(VARCHAR(19), s.fechasol, 126) AS fecha,
            s.cantdsol AS cantidad,
            (SELECT SUM(t.cantd_temp) FROM dbo.tarticulos t WHERE t.numerosol_temp = s.numerosol) AS unidades
     FROM dbo.solpedpapeleria s
     WHERE RTRIM(s.deptmsol) = @cedula
     ORDER BY s.numerosol DESC`,
    { limite: [sql.Int, limite], cedula: [sql.NVarChar(100), cedula] },
  );
}
