import { amapolanet, caa } from '../../config/db.js';
import { TIPOS_RRHH, ACCESOS } from './catalogos.constantes.js';

/** Tipos de solicitud. Por ahora solo RRHH tiene subtipos (lista fija). */
export async function tiposSolicitud(area) {
  if (!area || area === 'RRHH') return TIPOS_RRHH.map(({ valor, ...t }) => t);
  return [];
}

/**
 * Artículos que se pueden pedir.
 *  PAPELERIA   → amapolanet.articulos (estado 1, sin nombres vacíos)
 *  INSUMO_SIST → CAA.insumos_sist (tipo + modelo + equipo)
 */
export async function articulos(categoria) {
  if (categoria === 'PAPELERIA') {
    return amapolanet.query(
      `SELECT CAST(idarticulo AS INT) AS id, LTRIM(RTRIM(articulo)) AS nombre, N'Unidad' AS unidad,
              stock, CAST(NULL AS INT) AS maxPorSolicitud
       FROM dbo.articulos
       WHERE estado = 1 AND NULLIF(LTRIM(RTRIM(articulo)), '') IS NOT NULL
       ORDER BY LTRIM(RTRIM(articulo))`,
    );
  }
  return caa.query(
    `SELECT CAST(idinsumo AS INT) AS id,
            CONCAT(LTRIM(RTRIM(tipoinsumo)),
                   CASE WHEN NULLIF(LTRIM(RTRIM(modelo)), '') IS NULL THEN '' ELSE CONCAT(' ', LTRIM(RTRIM(modelo))) END,
                   CASE WHEN NULLIF(LTRIM(RTRIM(equipo)), '') IS NULL THEN '' ELSE CONCAT(' · ', LTRIM(RTRIM(equipo))) END) AS nombre,
            LTRIM(RTRIM(tipoinsumo)) AS tipo, N'Unidad' AS unidad, stock, CAST(NULL AS INT) AS maxPorSolicitud
     FROM dbo.insumos_sist
     ORDER BY LTRIM(RTRIM(tipoinsumo)), LTRIM(RTRIM(modelo))`,
  );
}

export async function accesos() {
  return ACCESOS.map(({ valor, ...a }) => a);
}

/** CAA.tipo_soporte (idtipo, tipost, estadost) */
export const tiposSoporte = () => caa.query(
  `SELECT CAST(idtipo AS INT) AS id, LTRIM(RTRIM(tipost)) AS nombre
   FROM dbo.tipo_soporte WHERE estadost = 1 ORDER BY LTRIM(RTRIM(tipost))`,
);

/** CAA.unidades_dpto (unidad, nombre, estatus) */
export const departamentos = () => caa.query(
  `SELECT LTRIM(RTRIM(unidad)) AS id, LTRIM(RTRIM(nombre)) AS nombre
   FROM dbo.unidades_dpto WHERE estatus = 1 ORDER BY LTRIM(RTRIM(nombre))`,
);
