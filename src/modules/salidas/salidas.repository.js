import { amapolanet, sql } from '../../config/db.js';

/*
 * Autorización de salida de materiales y equipos — mismas tablas que aut_salidas.aspx (amapolanet):
 *   parametros  (tipo_para = 'aut_salidas')
 *   autsalidas  (numero_auts, fecha_elab_auts, fecha_auts, fecha_retorno, deptm_auts, solicitante_auts,
 *                cedula_retira_auts, retira_auts, responsable_recepcion = '0', observacion)
 *   detsalidas  ← "INSERT INTO detsalidas SELECT * FROM temp_salidas" en el C#: mismas posiciones que
 *                temp_salidas (item_temp, cantd_temp, responsable_retorno, retorno, numero_temp).
 *                Al imprimir se leen item_dsal y numero_dsal.
 * No se usa temp_salidas: los renglones se guardan directo en detsalidas, en una transacción.
 */

const CAMPOS_TEMP = { item: 'item_temp', cantidad: 'cantd_temp', responsable: 'responsable_retorno', retorno: 'retorno', numero: 'numero_temp' };
const q = (n) => `[${n.replace(/]/g, ']]')}]`;

let mapaDetalle = null;
/** Columna de detsalidas que corresponde a cada campo de temp_salidas (por posición, como el SELECT *). */
async function columnasDetalle() {
  if (mapaDetalle) return mapaDetalle;
  const cols = await amapolanet.query(
    `SELECT OBJECT_NAME(object_id) AS tabla, name, is_identity AS identidad, column_id
     FROM sys.columns WHERE object_id IN (OBJECT_ID('dbo.temp_salidas'), OBJECT_ID('dbo.detsalidas'))
     ORDER BY tabla, column_id`,
  );
  const temp = cols.filter((c) => c.tabla.toLowerCase() === 'temp_salidas');
  const det = cols.filter((c) => c.tabla.toLowerCase() === 'detsalidas');
  const mapa = {};
  for (const [campo, nombreTemp] of Object.entries(CAMPOS_TEMP)) {
    const i = temp.findIndex((c) => c.name.toLowerCase() === nombreTemp);
    const destino = det[i];
    if (i === -1 || !destino || destino.identidad) throw new Error(`No se pudo ubicar la columna de detsalidas para ${nombreTemp}`);
    mapa[campo] = q(destino.name);
  }
  mapaDetalle = mapa;
  return mapa;
}

export async function crear(s) {
  const d = await columnasDetalle();
  return amapolanet.withTransaction(async (tx) => {
    const [p] = await amapolanet.query(
      `UPDATE dbo.parametros WITH (UPDLOCK, ROWLOCK) SET num_para = num_para + 1
       OUTPUT inserted.num_para AS numero WHERE tipo_para = 'aut_salidas'`, {}, tx,
    );
    if (!p) throw new Error("No existe el parámetro 'aut_salidas' en amapolanet.parametros");
    const numero = String(p.numero);

    await amapolanet.query(
      `INSERT INTO dbo.autsalidas (numero_auts, fecha_elab_auts, fecha_auts, fecha_retorno, deptm_auts, solicitante_auts,
                                   cedula_retira_auts, retira_auts, responsable_recepcion, observacion)
       VALUES (@numero, GETDATE(), @salida, @retornoFecha, @dpto, @solicitante, @cedulaRetira, @retira, '0', @observacion)`,
      {
        numero: [sql.NVarChar(20), numero],
        salida: [sql.Date, s.fechaSalida],
        retornoFecha: [sql.Date, s.retorna ? s.fechaRetorno : null],
        dpto: [sql.NVarChar(150), s.departamento],
        solicitante: [sql.NVarChar(150), s.solicitante],
        cedulaRetira: [sql.NVarChar(20), s.cedulaRetira ?? ''],
        retira: [sql.NVarChar(150), s.retira],
        observacion: [sql.NVarChar(1000), s.observacion ?? ''],
      }, tx,
    );
    for (const it of s.items) {
      await amapolanet.query(
        `INSERT INTO dbo.detsalidas (${d.item}, ${d.cantidad}, ${d.responsable}, ${d.retorno}, ${d.numero})
         VALUES (@item, @cantidad, @responsable, @retorno, @numero)`,
        {
          item: [sql.NVarChar(300), it.descripcion],
          cantidad: [sql.NVarChar(20), String(it.cantidad)],
          responsable: [sql.NVarChar(150), s.solicitante],
          retorno: [sql.NVarChar(2), s.retorna ? 'SI' : 'NO'],
          numero: [sql.NVarChar(20), numero],
        }, tx,
      );
    }
    return numero;
  });
}

export async function obtener(numero) {
  const d = await columnasDetalle();
  const p = { numero: [sql.NVarChar(20), String(numero)] };
  const [c] = await amapolanet.query(
    `SELECT TOP 1 RTRIM(numero_auts) AS numero, CONVERT(VARCHAR(10), fecha_elab_auts, 23) AS fechaElaboracion,
            CONVERT(VARCHAR(10), fecha_auts, 23) AS fechaSalida, CONVERT(VARCHAR(10), fecha_retorno, 23) AS fechaRetorno,
            RTRIM(deptm_auts) AS departamento, RTRIM(solicitante_auts) AS solicitante,
            RTRIM(cedula_retira_auts) AS cedulaRetira, RTRIM(retira_auts) AS retira, RTRIM(observacion) AS observacion
     FROM dbo.autsalidas WHERE RTRIM(numero_auts) = @numero`, p,
  );
  if (!c) return null;
  const items = await amapolanet.query(
    `SELECT RTRIM(${d.item}) AS descripcion, RTRIM(CONVERT(VARCHAR(20), ${d.cantidad})) AS cantidad, RTRIM(${d.retorno}) AS retorno
     FROM dbo.detsalidas WHERE RTRIM(${d.numero}) = @numero ORDER BY ${d.item}`, p,
  );
  return { ...c, items };
}

/** autsalidas no guarda la cédula del solicitante: se busca por "NOMBRE-APELLIDO". */
export function historial(solicitante, limite) {
  return amapolanet.query(
    `SELECT TOP (@limite) RTRIM(numero_auts) AS numero, CONVERT(VARCHAR(19), fecha_elab_auts, 126) AS fecha,
            CONVERT(VARCHAR(10), fecha_auts, 23) AS fechaSalida, CONVERT(VARCHAR(10), fecha_retorno, 23) AS fechaRetorno,
            RTRIM(retira_auts) AS retira
     FROM dbo.autsalidas WHERE RTRIM(solicitante_auts) = @solicitante ORDER BY fecha_elab_auts DESC`,
    { limite: [sql.Int, limite], solicitante: [sql.NVarChar(150), solicitante] },
  );
}
