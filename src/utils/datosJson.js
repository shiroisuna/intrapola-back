import fs from 'node:fs';
import path from 'node:path';

/*
 * Datos editables desde el panel que no tienen tabla en amapolanet ni en CAA.
 * Se guardan como JSON en la carpeta DATOS_DIR (por defecto backend/datos), fuera de git.
 */
const dir = () => path.resolve(process.env.DATOS_DIR || 'datos');
const memoria = new Map();

/** Lee datos/<nombre>.json; si no existe, devuelve los valores por defecto. */
export function leerDatos(nombre, porDefecto) {
  if (memoria.has(nombre)) return memoria.get(nombre);
  let valor = porDefecto;
  try {
    valor = { ...porDefecto, ...JSON.parse(fs.readFileSync(path.join(dir(), `${nombre}.json`), 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[datos] no se pudo leer ${nombre}.json: ${err.message}`);
  }
  memoria.set(nombre, valor);
  return valor;
}

/** Escribe de forma segura (archivo temporal + renombrar) para no dejar un JSON a medias. */
export function guardarDatos(nombre, valor) {
  fs.mkdirSync(dir(), { recursive: true });
  const final = path.join(dir(), `${nombre}.json`);
  const tmp = `${final}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2));
  fs.renameSync(tmp, final);
  memoria.set(nombre, valor);
  return valor;
}
