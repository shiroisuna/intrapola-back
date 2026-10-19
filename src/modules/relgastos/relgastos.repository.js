import { amapolanet, sql } from '../../config/db.js';

/*
 * Relación de gastos — mismas tablas que relgastos.aspx (amapolanet):
 *   parametros   (tipo_para = 'relgastos', num_para = último número usado)
 *   relgasto     → INSERT posicional en el C#: fecha, número, cédula, empleado ("NOMBRE-APELLIDO"),
 *                  departamento, total gasto, anticipo, saldo a favor empresa, concepto, observaciones
 *   det_relgasto → número, fecha del gasto, tipo de gasto, monto (copia de temp_relgasto)
 *
 * El C# no nombra las columnas, así que se leen de sys.columns (en su orden) y se usan con su nombre real.
 * No se usa temp_relgasto: los renglones llegan juntos desde el navegador.
 */

const CAMPOS_CABECERA = ['fecha', 'numero', 'cedula', 'empleado', 'departamento', 'totalGasto', 'anticipo', 'saldoEmpresa', 'concepto', 'observaciones'];
const CAMPOS_DETALLE = ['numero', 'fecha', 'tipo', 'monto'];

const cacheColumnas = new Map();
async function columnas(tabla, campos) {
  if (!cacheColumnas.has(tabla)) {
    const filas = await amapolanet.query(
      `SELECT c.name FROM sys.columns c
       WHERE c.object_id = OBJECT_ID(@tabla) AND c.is_identity = 0 AND c.is_computed = 0
       ORDER BY c.column_id`,
      { tabla: [sql.NVarChar(128), `dbo.${tabla}`] },
    );
    if (filas.length < campos.length) {
      throw new Error(`La tabla ${tabla} tiene ${filas.length} columnas y se esperaban ${campos.length}`);
    }
    const q = (n) => `[${n.replace(/]/g, ']]')}]`;
    cacheColumnas.set(tabla, Object.fromEntries(campos.map((c, i) => [c, q(filas[i].name)])));
  }
  return cacheColumnas.get(tabla);
}
const cab = () => columnas('relgasto', CAMPOS_CABECERA);
const det = () => columnas('det_relgasto', CAMPOS_DETALLE);

/** Tipos de gasto usados antes (los más frecuentes primero). */
export async function tiposUsados() {
  const d = await det();
  const filas = await amapolanet.query(
    `SELECT TOP 40 LTRIM(RTRIM(${d.tipo})) AS tipo, COUNT(*) AS n FROM dbo.det_relgasto
     WHERE LTRIM(RTRIM(ISNULL(${d.tipo}, ''))) <> '' GROUP BY LTRIM(RTRIM(${d.tipo})) ORDER BY n DESC`,
  );
  return filas.map((f) => f.tipo);
}

const dinero = (n) => Number(n).toFixed(2); // punto decimal, sin miles (sirve si la columna es texto o decimal)

/** Button4_Click: reserva el número, guarda cabecera y renglones. Todo en una transacción. */
export async function crear(r) {
  const [c, d] = await Promise.all([cab(), det()]);
  return amapolanet.withTransaction(async (tx) => {
    const [p] = await amapolanet.query(
      `UPDATE dbo.parametros WITH (UPDLOCK, ROWLOCK) SET num_para = num_para + 1
       OUTPUT inserted.num_para AS numero WHERE tipo_para = 'relgastos'`, {}, tx,
    );
    if (!p) throw new Error("No existe el parámetro 'relgastos' en amapolanet.parametros");
    const numero = String(p.numero);

    await amapolanet.query(
      `INSERT INTO dbo.relgasto (${CAMPOS_CABECERA.map((k) => c[k]).join(', ')})
       VALUES (GETDATE(), @numero, @cedula, @empleado, @departamento, @totalGasto, @anticipo, @saldoEmpresa, @concepto, @observaciones)`,
      {
        numero: [sql.NVarChar(20), numero],
        cedula: [sql.NVarChar(20), r.cedula],
        empleado: [sql.NVarChar(150), r.empleado],
        departamento: [sql.NVarChar(150), r.departamento],
        totalGasto: [sql.NVarChar(30), dinero(r.totalGasto)],
        anticipo: [sql.NVarChar(30), dinero(r.anticipo)],
        saldoEmpresa: [sql.NVarChar(30), dinero(r.saldoEmpresa)],
        concepto: [sql.NVarChar(500), r.concepto],
        observaciones: [sql.NVarChar(1000), r.observaciones ?? ''],
      }, tx,
    );
    for (const g of r.gastos) {
      await amapolanet.query(
        `INSERT INTO dbo.det_relgasto (${CAMPOS_DETALLE.map((k) => d[k]).join(', ')}) VALUES (@numero, @fecha, @tipo, @monto)`,
        {
          numero: [sql.NVarChar(20), numero],
          fecha: [sql.NVarChar(10), g.fecha], // yyyy-mm-dd, como el TextBox de fecha del C#
          tipo: [sql.NVarChar(100), g.tipo],
          monto: [sql.NVarChar(30), dinero(g.monto)],
        }, tx,
      );
    }
    return numero;
  });
}

export async function obtener(numero) {
  const [c, d] = await Promise.all([cab(), det()]);
  const p = { numero: [sql.NVarChar(20), String(numero)] };
  const [f] = await amapolanet.query(
    `SELECT TOP 1 CONVERT(VARCHAR(10), ${c.fecha}, 23) AS fecha, RTRIM(${c.numero}) AS numero, RTRIM(${c.cedula}) AS cedula,
            RTRIM(${c.empleado}) AS empleado, RTRIM(${c.departamento}) AS departamento,
            RTRIM(CONVERT(VARCHAR(30), ${c.totalGasto})) AS totalGasto, RTRIM(CONVERT(VARCHAR(30), ${c.anticipo})) AS anticipo,
            RTRIM(CONVERT(VARCHAR(30), ${c.saldoEmpresa})) AS saldoEmpresa,
            RTRIM(${c.concepto}) AS concepto, RTRIM(${c.observaciones}) AS observaciones
     FROM dbo.relgasto WHERE RTRIM(${c.numero}) = @numero`, p,
  );
  if (!f) return null;
  const gastos = await amapolanet.query(
    `SELECT CONVERT(VARCHAR(10), ${d.fecha}, 23) AS fecha, RTRIM(${d.tipo}) AS tipo, RTRIM(CONVERT(VARCHAR(30), ${d.monto})) AS monto
     FROM dbo.det_relgasto WHERE RTRIM(${d.numero}) = @numero ORDER BY ${d.fecha}`, p,
  );
  return { ...f, gastos };
}

export async function historial(cedula, limite) {
  const c = await cab();
  return amapolanet.query(
    `SELECT TOP (@limite) RTRIM(${c.numero}) AS numero, CONVERT(VARCHAR(19), ${c.fecha}, 126) AS fecha,
            RTRIM(${c.concepto}) AS concepto, RTRIM(CONVERT(VARCHAR(30), ${c.totalGasto})) AS totalGasto
     FROM dbo.relgasto WHERE RTRIM(${c.cedula}) = @cedula ORDER BY ${c.fecha} DESC`,
    { limite: [sql.Int, limite], cedula: [sql.NVarChar(20), cedula] },
  );
}
