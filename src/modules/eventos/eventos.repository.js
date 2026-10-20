import { amapolanet, sql } from '../../config/db.js';
import { urlLegacy } from '../../utils/imagenesLegacy.js';

const { query } = amapolanet; // BD amapolanet

/*
 * Eventos: amapolanet.eventos (idevento, evento, imgevento, urlevento, estado)
 * estado = 1 → visible.
 * - Eventos de la Intrapola actual: imgevento/urlevento son rutas "~/imagenes/x.jpg" o páginas HTML del IIS.
 * - Eventos creados desde el panel nuevo: imgevento = "/uploads/eventos/<id>/portada-xxx.jpg" y
 *   urlevento = "/uploads/eventos/<id>/" (las fotos de la galería están en esa carpeta, subcarpeta fotos/).
 */
export const PREFIJO = '/uploads/eventos/';
const esNuevo = (url) => (url || '').startsWith(PREFIJO);
const imagen = (ruta) => (esNuevo(ruta) ? ruta : urlLegacy(ruta));

const aEvento = (f) => ({
  id: f.id,
  titulo: f.titulo,
  descripcion: null,
  fecha: null,
  lugar: null,
  imagenUrl: imagen(f.img),
  galeria: esNuevo(f.url),                // true → galería en la Intrapola nueva (/eventos/:id)
  enlace: esNuevo(f.url) ? null : urlLegacy(f.url),
  activo: f.estado === 1 || f.estado === '1' || f.estado === true,
});

const COLUMNAS = `idevento AS id, LTRIM(RTRIM(evento)) AS titulo, LTRIM(RTRIM(imgevento)) AS img,
                  LTRIM(RTRIM(urlevento)) AS url, estado`;

export async function listar(limite) {
  const filas = await query(
    `SELECT TOP (@limite) ${COLUMNAS} FROM dbo.eventos WHERE estado = 1 ORDER BY idevento DESC`,
    { limite: [sql.Int, limite] },
  );
  return filas.map(aEvento);
}

/** Todos (activos e inactivos) para el panel. */
export async function todos() {
  const filas = await query(`SELECT TOP 300 ${COLUMNAS} FROM dbo.eventos ORDER BY idevento DESC`);
  return filas.map(aEvento);
}

export async function obtener(id) {
  const [f] = await query(`SELECT ${COLUMNAS} FROM dbo.eventos WHERE idevento = @id`, { id: [sql.Int, id] });
  return f ? aEvento(f) : null;
}

/** Crea el evento (idevento IDENTITY o MAX+1) y devuelve su id. La portada se asigna después. */
export async function crear(titulo) {
  const [row] = await query(
    `SET XACT_ABORT ON;
     BEGIN TRAN;
     DECLARE @id INT;
     IF COLUMNPROPERTY(OBJECT_ID('dbo.eventos'), 'idevento', 'IsIdentity') = 1
     BEGIN
       INSERT INTO dbo.eventos (evento, imgevento, urlevento, estado) VALUES (@titulo, '', '', 0);
       SET @id = SCOPE_IDENTITY();
     END
     ELSE
     BEGIN
       SELECT @id = ISNULL(MAX(idevento), 0) + 1 FROM dbo.eventos WITH (UPDLOCK, HOLDLOCK);
       EXEC sp_executesql N'INSERT INTO dbo.eventos (idevento, evento, imgevento, urlevento, estado) VALUES (@id, @titulo, '''', '''', 0)',
         N'@id INT, @titulo NVARCHAR(200)', @id, @titulo;
     END
     COMMIT;
     SELECT @id AS id;`,
    { titulo: [sql.NVarChar(200), titulo] },
  );
  return row.id;
}

/** Actualiza solo los campos recibidos: { titulo, img, url, activo }. */
export async function actualizar(id, { titulo, img, url, activo }) {
  const sets = [];
  const p = { id: [sql.Int, id] };
  if (titulo !== undefined) { sets.push('evento = @titulo'); p.titulo = [sql.NVarChar(200), titulo]; }
  if (img !== undefined) { sets.push('imgevento = @img'); p.img = [sql.NVarChar(300), img]; }
  if (url !== undefined) { sets.push('urlevento = @url'); p.url = [sql.NVarChar(300), url]; }
  if (activo !== undefined) { sets.push('estado = @estado'); p.estado = [sql.Int, activo ? 1 : 0]; }
  if (!sets.length) return obtener(id);
  await query(`UPDATE dbo.eventos SET ${sets.join(', ')} WHERE idevento = @id`, p);
  return obtener(id);
}

/** Borra la fila (solo para eventos creados en el panel; los viejos solo se ocultan). */
export const eliminar = (id) => query(`DELETE FROM dbo.eventos WHERE idevento = @id`, { id: [sql.Int, id] });
