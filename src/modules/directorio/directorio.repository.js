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

/* ---------------------- Gestión (panel de administración) ---------------------- */
const TIPO_DE_ESTADO = { 0: 'inactiva', 1: 'extension', 2: 'emergencia', 3: 'proveedor' };

/** Todo el directorio con su tipo, para el panel. */
export async function todos() {
  const filas = await query(
    `SELECT ${CAMPOS}, estado_ext AS estado, NULLIF(LTRIM(RTRIM(usuario_st)), '') AS usuario
     FROM dbo.extenciones
     ORDER BY estado_ext, LTRIM(RTRIM(departamento_ext)), LTRIM(RTRIM(nombre_ext))`,
  );
  return filas.map((f) => ({
    id: f.id,
    tipo: TIPO_DE_ESTADO[f.estado] ?? 'inactiva',
    departamento: f.departamento ?? '',
    nombre: f.nombre ?? '',
    extension: f.extension && f.extension !== '0' ? f.extension : '',
    telefono: f.asterisco || (f.extension && f.extension !== '0' ? f.extension : ''),
    correo: f.correo ?? '',
    asterisco: f.asterisco ?? '',
    esPersona: Boolean(f.esPersona),
    usuario: f.usuario,
  }));
}

export async function obtener(id) {
  const [f] = await query(`SELECT id_ext AS id, estado_ext AS estado, NULLIF(LTRIM(RTRIM(usuario_st)), '') AS usuario FROM dbo.extenciones WHERE id_ext = @id`, { id: [sql.Int, id] });
  return f ?? null;
}

/**
 * Convierte lo que llega del panel a columnas:
 *   extensión  → numero_ext = número, asterisco_ext = marcación rápida (opcional)
 *   emergencia / proveedor → el teléfono va en asterisco_ext (no cabe en numero_ext, que es int) y numero_ext = 0
 */
function columnas(d, usuarioActual) {
  const esExt = d.tipo === 'extension';
  const persona = esExt && d.esPersona;
  return {
    departamento: [sql.NVarChar(150), d.departamento],
    nombre: [sql.NVarChar(150), d.nombre],
    usuario: [sql.NVarChar(150), persona ? (usuarioActual || d.nombre.toUpperCase().replace(/\s+/g, '-')) : ''],
    numero: [sql.Int, esExt ? Number(d.extension) : 0],
    correo: [sql.NVarChar(150), d.correo || ''],
    asterisco: [sql.NVarChar(50), esExt ? (d.asterisco || '') : d.telefono],
    estado: [sql.Int, ESTADOS[d.tipo]],
  };
}

export async function crear(d) {
  const [row] = await query(
    `SET XACT_ABORT ON;
     BEGIN TRAN;
     DECLARE @id INT;
     IF COLUMNPROPERTY(OBJECT_ID('dbo.extenciones'), 'id_ext', 'IsIdentity') = 1
     BEGIN
       INSERT INTO dbo.extenciones (departamento_ext, nombre_ext, usuario_st, numero_ext, correo_ext, asterisco_ext, estado_ext)
       VALUES (@departamento, @nombre, @usuario, @numero, @correo, @asterisco, @estado);
       SET @id = SCOPE_IDENTITY();
     END
     ELSE
     BEGIN
       SELECT @id = ISNULL(MAX(id_ext), 0) + 1 FROM dbo.extenciones WITH (UPDLOCK, HOLDLOCK);
       EXEC sp_executesql N'INSERT INTO dbo.extenciones (id_ext, departamento_ext, nombre_ext, usuario_st, numero_ext, correo_ext, asterisco_ext, estado_ext)
                            VALUES (@id, @departamento, @nombre, @usuario, @numero, @correo, @asterisco, @estado)',
         N'@id INT, @departamento NVARCHAR(150), @nombre NVARCHAR(150), @usuario NVARCHAR(150), @numero INT, @correo NVARCHAR(150), @asterisco NVARCHAR(50), @estado INT',
         @id, @departamento, @nombre, @usuario, @numero, @correo, @asterisco, @estado;
     END
     COMMIT;
     SELECT @id AS id;`,
    columnas(d),
  );
  return row.id;
}

export async function actualizar(id, d, usuarioActual) {
  await query(
    `UPDATE dbo.extenciones
     SET departamento_ext = @departamento, nombre_ext = @nombre, usuario_st = @usuario, numero_ext = @numero,
         correo_ext = @correo, asterisco_ext = @asterisco, estado_ext = @estado
     WHERE id_ext = @id`,
    { ...columnas(d, usuarioActual), id: [sql.Int, id] },
  );
}

/** Extensiones: se desactivan (estado 0) y se pueden reactivar. */
export const cambiarEstado = (id, estado) => query(`UPDATE dbo.extenciones SET estado_ext = @estado WHERE id_ext = @id`, { id: [sql.Int, id], estado: [sql.Int, estado] });
/** Emergencias y proveedores: se borran (su tipo vive en estado_ext, no se pueden "desactivar"). */
export const eliminar = (id) => query(`DELETE FROM dbo.extenciones WHERE id_ext = @id`, { id: [sql.Int, id] });
