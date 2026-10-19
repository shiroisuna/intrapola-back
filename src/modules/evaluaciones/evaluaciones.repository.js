import { caa, sql } from '../../config/db.js';
import { HttpError } from '../../utils/http.js';

/*
 * Evaluación de proveedores — mismas tablas que eval_prov.aspx (CAA):
 *   proveedores  (rifprov, nombreprov, idprov)
 *   cab_evalprov → INSERT posicional de 22 valores en el C# (ver CAMPOS_CAB). Lo que va en cada posición sale
 *                  de comparar los tres .aspx (servicios, MP/ME y transporte); contrato_eval identifica la evaluación
 *   det_evalprov → INSERT posicional: contrato, pregunta, cumple (SI/NO), puntuación, sección, '1'
 * Los nombres reales de las columnas se leen de sys.columns, en su orden.
 */
const CAMPOS_CAB = [
  'fecha', 'rif', 'codigo', 'contrato', 'factura',
  'tipo',             // 'SERVICIOS', 'TRANSPORTE' o el tipo de proveedor (Materia Prima, ...)
  'descripcion',      // tipo de servicio (servicios) o material suministrado (MP/ME); '0' en transporte
  'cantSuministrada', // MP/ME; 0 en los demás
  'cantRechazada',    // MP/ME; '0' en los demás
  'puntuacion', 'resultado', 'c12', 'observaciones', 'evaluador', 'cargo', 'departamento',
  'c17', 'c18', 'c19', 'c20', 'estado',
  'lote',             // lote Amapola (MP/ME)
];
const CAMPOS_DET = ['contrato', 'pregunta', 'cumple', 'puntos', 'seccion', 'estado'];

const q = (n) => `[${n.replace(/]/g, ']]')}]`;
const cache = new Map();
/**
 * Columnas reales de la tabla, en el orden de `campos`: { campo: { col: '[nombre]', max: caracteres } }.
 * max = Infinity para tipos sin límite de texto (int, datetime, varchar(max)...).
 */
async function columnas(tabla, campos) {
  if (!cache.has(tabla)) {
    const filas = await caa.query(
      `SELECT c.name, c.max_length AS largo, t.name AS tipo
       FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
       WHERE c.object_id = OBJECT_ID(@t) AND c.is_identity = 0 AND c.is_computed = 0 ORDER BY c.column_id`,
      { t: [sql.NVarChar(128), `dbo.${tabla}`] },
    );
    if (filas.length < campos.length) throw new Error(`La tabla ${tabla} tiene ${filas.length} columnas y se esperaban ${campos.length}`);
    const maxDe = ({ largo, tipo }) => {
      if (!/char/i.test(tipo) || largo === -1) return Infinity;
      return /^n/i.test(tipo) ? largo / 2 : largo;
    };
    cache.set(tabla, Object.fromEntries(campos.map((c, i) => [c, { col: q(filas[i].name), max: maxDe(filas[i]) }])));
  }
  return cache.get(tabla);
}

/* Lo que escribe el usuario: si no cabe, se le avisa con el campo y el límite real de la columna */
const ETIQUETAS = {
  contrato: 'Contrato u orden', factura: 'Factura / NE', descripcion: 'Descripción',
  observaciones: 'Observaciones', lote: 'Lote Amapola', cantSuministrada: 'Cantidad suministrada', cantRechazada: 'Cantidad rechazada',
};
const avisados = new Set();
/** Ajusta un valor al largo de su columna: error 400 si lo escribió el usuario, recorte si lo genera el sistema. */
function ajustar(cols, campo, valor, tabla) {
  const v = valor == null ? '' : String(valor);
  const { max } = cols[campo];
  if (v.length <= max) return v;
  if (ETIQUETAS[campo]) {
    throw new HttpError(400, `${ETIQUETAS[campo]}: máximo ${max} caracteres (escribió ${v.length})`,
      [{ campo, mensaje: `Máximo ${max} caracteres` }]);
  }
  const k = `${tabla}.${campo}`;
  if (!avisados.has(k)) { avisados.add(k); console.warn(`[evaluaciones] ${k} admite ${max} caracteres; se recorta "${v}"`); }
  return v.slice(0, max);
}

/** Límites reales de los campos que escribe el usuario (para los maxLength del formulario). */
export async function limites() {
  const c = await columnas('cab_evalprov', CAMPOS_CAB);
  return Object.fromEntries(Object.keys(ETIQUETAS).filter((k) => Number.isFinite(c[k].max)).map((k) => [k, c[k].max]));
}

/** Proveedor por RIF, sin importar guiones o espacios ("J-12345678-9" = "J123456789"). */
export async function proveedorPorRif(rif) {
  const [p] = await caa.query(
    `SELECT TOP 1 RTRIM(rifprov) AS rif, RTRIM(nombreprov) AS nombre, RTRIM(CONVERT(VARCHAR(30), idprov)) AS codigo
     FROM dbo.proveedores
     WHERE REPLACE(REPLACE(REPLACE(UPPER(rifprov), '-', ''), ' ', ''), '.', '') = @rif`,
    { rif: [sql.NVarChar(20), rif] },
  );
  return p ?? null;
}

export async function existeContrato(contrato) {
  const [f] = await caa.query(
    `SELECT COUNT(*) AS n FROM dbo.cab_evalprov WHERE RTRIM(contrato_eval) = @c`,
    { c: [sql.NVarChar(50), contrato] },
  );
  return f.n > 0;
}

export async function crear(e) {
  const [c, d] = await Promise.all([columnas('cab_evalprov', CAMPOS_CAB), columnas('det_evalprov', CAMPOS_DET)]);
  return caa.withTransaction(async (tx) => {
    // Dentro de la transacción, con bloqueo, para que dos personas no evalúen el mismo contrato a la vez
    const [dup] = await caa.query(
      `SELECT COUNT(*) AS n FROM dbo.cab_evalprov WITH (UPDLOCK, HOLDLOCK) WHERE RTRIM(contrato_eval) = @c`,
      { c: [sql.NVarChar(50), e.contrato] }, tx,
    );
    if (dup.n > 0) {
      throw new HttpError(409, 'Ese número de contrato u orden ya fue evaluado', [{ campo: 'contrato', mensaje: 'Este contrato u orden ya tiene una evaluación' }]);
    }
    const txt = (v) => [sql.NVarChar(4000), v];
    const cab = (k, v) => txt(ajustar(c, k, v, 'cab_evalprov'));
    const det = (k, v) => txt(ajustar(d, k, v, 'det_evalprov'));
    await caa.query(
      `INSERT INTO dbo.cab_evalprov (${CAMPOS_CAB.map((k) => c[k].col).join(', ')})
       VALUES (@fecha, @rif, @codigo, @contrato, @factura, @tipo, @descripcion, @cantSuministrada, @cantRechazada, @puntuacion,
               @resultado, '', @observaciones, @evaluador, @cargo, @departamento, '', '', '', '', 1, @lote)`,
      {
        fecha: txt(e.fecha),
        rif: cab('rif', e.rif),
        codigo: cab('codigo', e.codigo),
        contrato: cab('contrato', e.contrato),
        factura: cab('factura', e.factura),
        tipo: cab('tipo', e.tipo),
        descripcion: cab('descripcion', e.descripcion),
        cantSuministrada: cab('cantSuministrada', e.cantSuministrada ?? 0),
        cantRechazada: cab('cantRechazada', e.cantRechazada ?? 0),
        lote: cab('lote', e.lote),
        puntuacion: cab('puntuacion', e.puntuacion),
        resultado: cab('resultado', e.resultado),
        observaciones: cab('observaciones', e.observaciones),
        evaluador: cab('evaluador', e.evaluador),
        cargo: cab('cargo', e.cargo),
        departamento: cab('departamento', e.departamento),
      }, tx,
    );
    for (const r of e.respuestas) {
      await caa.query(
        `INSERT INTO dbo.det_evalprov (${CAMPOS_DET.map((k) => d[k].col).join(', ')}) VALUES (@contrato, @pregunta, @cumple, @puntos, @seccion, '1')`,
        {
          contrato: det('contrato', e.contrato),
          pregunta: det('pregunta', r.pregunta),
          cumple: det('cumple', r.cumple ? 'SI' : 'NO'),
          puntos: det('puntos', r.puntos),
          seccion: det('seccion', r.seccion),
        }, tx,
      );
    }
  });
}

export async function obtener(contrato) {
  const [c, d] = await Promise.all([columnas('cab_evalprov', CAMPOS_CAB), columnas('det_evalprov', CAMPOS_DET)]);
  const p = { c: [sql.NVarChar(50), contrato] };
  const [cab] = await caa.query(
    `SELECT TOP 1 RTRIM(CONVERT(VARCHAR(30), ${c.fecha.col}, 23)) AS fecha, RTRIM(${c.rif.col}) AS rif, RTRIM(CONVERT(VARCHAR(30), ${c.codigo.col})) AS codigo,
            RTRIM(${c.contrato.col}) AS contrato, RTRIM(${c.factura.col}) AS factura, RTRIM(${c.tipo.col}) AS tipo, RTRIM(CONVERT(VARCHAR(300), ${c.descripcion.col})) AS descripcion,
            RTRIM(CONVERT(VARCHAR(20), ${c.cantSuministrada.col})) AS cantSuministrada, RTRIM(CONVERT(VARCHAR(20), ${c.cantRechazada.col})) AS cantRechazada,
            RTRIM(CONVERT(VARCHAR(50), ${c.lote.col})) AS lote,
            RTRIM(CONVERT(VARCHAR(10), ${c.puntuacion.col})) AS puntuacion, RTRIM(${c.resultado.col}) AS resultado,
            RTRIM(${c.observaciones.col}) AS observaciones, RTRIM(${c.evaluador.col}) AS evaluador, RTRIM(${c.cargo.col}) AS cargo,
            RTRIM(${c.departamento.col}) AS departamento
     FROM dbo.cab_evalprov WHERE RTRIM(${c.contrato.col}) = @c`, p,
  );
  if (!cab) return null;
  const respuestas = await caa.query(
    `SELECT RTRIM(${d.pregunta.col}) AS pregunta, RTRIM(${d.cumple.col}) AS cumple, RTRIM(CONVERT(VARCHAR(10), ${d.puntos.col})) AS puntos, RTRIM(${d.seccion.col}) AS seccion
     FROM dbo.det_evalprov WHERE RTRIM(${d.contrato.col}) = @c`, p,
  );
  const prov = await caa.query(`SELECT TOP 1 RTRIM(nombreprov) AS nombre FROM dbo.proveedores WHERE RTRIM(rifprov) = @r`, { r: [sql.NVarChar(20), cab.rif] });
  return { ...cab, proveedor: prov[0]?.nombre ?? null, respuestas };
}
