import { amapolanet, sql } from '../../config/db.js';
import { urlLegacy } from '../../utils/imagenesLegacy.js';

const { query } = amapolanet; // BD amapolanet

/*
 * Eventos: amapolanet.eventos (idevento, evento, imgevento, urlevento, estado)
 * Son galerías de fotos (páginas HTML en el IIS), sin fecha. estado = 1 → visible.
 * Las rutas vienen como "~/imagenes/x.jpg" y se resuelven contra la app ASP.NET.
 */
export async function listar(limite) {
  const filas = await query(
    `SELECT TOP (@limite) idevento AS id, LTRIM(RTRIM(evento)) AS titulo,
            LTRIM(RTRIM(imgevento)) AS img, LTRIM(RTRIM(urlevento)) AS url
     FROM dbo.eventos
     WHERE estado = 1
     ORDER BY idevento DESC`,
    { limite: [sql.Int, limite] },
  );
  return filas.map((f) => ({
    id: f.id,
    titulo: f.titulo,
    descripcion: null,
    fecha: null,
    lugar: null,
    imagenUrl: urlLegacy(f.img),
    enlace: urlLegacy(f.url),
  }));
}
