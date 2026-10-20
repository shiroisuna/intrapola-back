import { amapolanet, sql } from '../../config/db.js';
import { urlImagen, urlLegacy, tituloDesdeArchivo } from '../../utils/imagenesLegacy.js';
import { EMPRESA, ENLACES, PRODUCTOS } from './contenido.constantes.js';
import { guardarDatos, leerDatos } from '../../utils/datosJson.js';

/*
 * Banners y comunicados: tablas de la Intrapola actual en amapolanet.
 *   intrapola_banner     (id_banner, img, ruta, estatus 'ACTIVO'|'INACTIVO')
 *   intrapola_comunicado (id_comunicado, imagen, ruta, estatus 'ACTIVO'|'INACTIVO')
 * Los campos son nchar: se aplica RTRIM para quitar los espacios de relleno.
 */

/* ------------------------------- Banners ------------------------------- */
export async function banners() {
  const filas = await amapolanet.query(
    `SELECT id_banner AS id, RTRIM(img) AS img, RTRIM(ruta) AS ruta
     FROM dbo.intrapola_banner
     WHERE RTRIM(estatus) = 'ACTIVO'
     ORDER BY id_banner DESC`,
  );
  return filas.map((f) => ({
    id: f.id,
    titulo: tituloDesdeArchivo(f.img),
    imagenUrl: urlImagen(f.ruta, f.img),
    enlace: null,
  }));
}

/**
 * Inserta en una tabla vieja cuyo id puede ser o no IDENTITY: si lo es deja que SQL lo genere,
 * si no, calcula MAX+1 con bloqueo para evitar duplicados.
 */
function insertarImagen(tabla, columnaId, columnaImg) {
  return async ({ archivo, ruta }) => {
    const [row] = await amapolanet.query(
      `SET XACT_ABORT ON;
       BEGIN TRAN;
       DECLARE @id INT;
       IF COLUMNPROPERTY(OBJECT_ID('dbo.${tabla}'), '${columnaId}', 'IsIdentity') = 1
       BEGIN
         INSERT INTO dbo.${tabla} (${columnaImg}, ruta, estatus) VALUES (@archivo, @ruta, 'ACTIVO');
         SET @id = SCOPE_IDENTITY();
       END
       ELSE
       BEGIN
         SELECT @id = ISNULL(MAX(${columnaId}), 0) + 1 FROM dbo.${tabla} WITH (UPDLOCK, HOLDLOCK);
         EXEC sp_executesql N'INSERT INTO dbo.${tabla} (${columnaId}, ${columnaImg}, ruta, estatus) VALUES (@id, @archivo, @ruta, ''ACTIVO'')',
           N'@id INT, @archivo NCHAR(255), @ruta NCHAR(255)', @id, @archivo, @ruta;
       END
       COMMIT;
       SELECT @id AS id;`,
      { archivo: [sql.NChar(255), archivo], ruta: [sql.NChar(255), ruta] },
    );
    return row;
  };
}

export const crearBanner = insertarImagen('intrapola_banner', 'id_banner', 'img');

export const desactivarBanner = (id) => amapolanet.query(
  `UPDATE dbo.intrapola_banner SET estatus = 'INACTIVO' OUTPUT inserted.id_banner AS id WHERE id_banner = @id`,
  { id: [sql.Int, id] },
);

/* ----------------------------- Comunicados ----------------------------- */
/*
 * Los comunicados actuales son solo una imagen. Se devuelven con la misma forma que usa el
 * frontend (titulo, contenido, fecha) para que más adelante se puedan enriquecer sin cambiar la vista.
 */
const aComunicado = (f) => ({
  id: f.id,
  titulo: 'Comunicado',
  resumen: null,
  contenido: null,
  imagenUrl: urlImagen(f.ruta, f.imagen),
  adjuntoUrl: null,
  prioridad: 'NORMAL',
  destacado: true, // equivalente al modal de la Intrapola actual: se abre solo una vez por persona
  publicadoEn: null,
  textoAlternativo: tituloDesdeArchivo(f.imagen),
});

export async function comunicadosVigentes(limite) {
  const filas = await amapolanet.query(
    `SELECT TOP (@limite) id_comunicado AS id, RTRIM(imagen) AS imagen, RTRIM(ruta) AS ruta
     FROM dbo.intrapola_comunicado
     WHERE RTRIM(estatus) = 'ACTIVO'
     ORDER BY id_comunicado DESC`,
    { limite: [sql.Int, limite] },
  );
  return filas.map(aComunicado);
}

export async function comunicadoPorId(id) {
  const [f] = await amapolanet.query(
    `SELECT id_comunicado AS id, RTRIM(imagen) AS imagen, RTRIM(ruta) AS ruta
     FROM dbo.intrapola_comunicado WHERE id_comunicado = @id`,
    { id: [sql.Int, id] },
  );
  return f ? aComunicado(f) : null;
}

export const crearComunicado = insertarImagen('intrapola_comunicado', 'id_comunicado', 'imagen');

export const desactivarComunicado = (id) => amapolanet.query(
  `UPDATE dbo.intrapola_comunicado SET estatus = 'INACTIVO' OUTPUT inserted.id_comunicado AS id WHERE id_comunicado = @id`,
  { id: [sql.Int, id] },
);

/* ------------------------- Resto del inicio ---------------------------- */
// Sin tabla: vienen de contenido.constantes.js
export const productos = async () => PRODUCTOS.map((p) => ({ ...p, imagenUrl: urlLegacy(p.imagenUrl) }));
export const enlaces = async () => ENLACES;
// Datos de la empresa: editables desde el panel (datos/empresa.json); EMPRESA son los valores iniciales
export const empresa = async () => leerDatos('empresa', EMPRESA);
export const EMPRESA_INICIAL = EMPRESA;
export const guardarEmpresa = (datos) => guardarDatos('empresa', { ...EMPRESA, ...datos });

/* ---------------------- Gestión (panel de administración) ---------------------- */
/** Banners o comunicados con su estado, los activos primero. */
function listarTodos(tabla, columnaId, columnaImg) {
  return async () => {
    const filas = await amapolanet.query(
      `SELECT TOP 200 ${columnaId} AS id, RTRIM(${columnaImg}) AS img, RTRIM(ruta) AS ruta, RTRIM(estatus) AS estatus
       FROM dbo.${tabla}
       ORDER BY CASE WHEN RTRIM(estatus) = 'ACTIVO' THEN 0 ELSE 1 END, ${columnaId} DESC`,
    );
    return filas.map((f) => ({
      id: f.id,
      titulo: tituloDesdeArchivo(f.img),
      imagenUrl: urlImagen(f.ruta, f.img),
      activo: f.estatus === 'ACTIVO',
      subidaAqui: (f.ruta || '').startsWith('/uploads/'),
    }));
  };
}

function cambiarEstado(tabla, columnaId) {
  return async (id, activo) => {
    const [f] = await amapolanet.query(
      `UPDATE dbo.${tabla} SET estatus = @estatus OUTPUT inserted.${columnaId} AS id WHERE ${columnaId} = @id`,
      { id: [sql.Int, id], estatus: [sql.NVarChar(10), activo ? 'ACTIVO' : 'INACTIVO'] },
    );
    return f ?? null;
  };
}

export const todosBanners = listarTodos('intrapola_banner', 'id_banner', 'img');
export const estadoBanner = cambiarEstado('intrapola_banner', 'id_banner');
export const todosComunicados = listarTodos('intrapola_comunicado', 'id_comunicado', 'imagen');
export const estadoComunicado = cambiarEstado('intrapola_comunicado', 'id_comunicado');

/** Deja inactivos todos los comunicados menos uno (al publicar uno nuevo que reemplaza al vigente). */
export const desactivarOtrosComunicados = (id) => amapolanet.query(
  `UPDATE dbo.intrapola_comunicado SET estatus = 'INACTIVO' WHERE id_comunicado <> @id AND RTRIM(estatus) = 'ACTIVO'`,
  { id: [sql.Int, id] },
);
