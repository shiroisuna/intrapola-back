import fs from 'node:fs';
import path from 'node:path';

/*
 * Colores de la Intrapola, editables desde el panel. Se guardan en un JSON del servidor
 * (TEMA_ARCHIVO, por defecto datos/tema.json). El frontend calcula los tonos a partir de estos tres:
 *   marca  → fondo del menú y del encabezado (verde del uniforme)
 *   accion → botones, enlaces y títulos destacados
 *   acento → cumpleaños, eventos y avisos
 */
export const POR_DEFECTO = Object.freeze({
  marca: '#bcdbc2', accion: '#1f4a33', acento: '#d99a3a',
  fuenteTitulos: 'bricolage', fuenteTexto: 'atkinson',
});
/** Fuentes incluidas en el frontend (src/utils/fuentes.js): no dependen de internet. */
export const FUENTES = ['bricolage', 'atkinson', 'inter', 'montserrat', 'nunito', 'lora', 'merriweather', 'source-sans', 'open-sans', 'roboto', 'sistema'];
const archivo = () => path.resolve(process.env.TEMA_ARCHIVO || 'datos/tema.json');

let enMemoria = null;

export function leer() {
  if (enMemoria) return enMemoria;
  try {
    const t = JSON.parse(fs.readFileSync(archivo(), 'utf8'));
    enMemoria = { ...POR_DEFECTO, ...t };
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[tema] no se pudo leer ${archivo()}: ${err.message}`);
    enMemoria = { ...POR_DEFECTO, actualizadoEn: null };
  }
  return enMemoria;
}

export function guardar({ marca, accion, acento, fuenteTitulos, fuenteTexto }, usuario) {
  const t = {
    marca, accion, acento,
    fuenteTitulos: fuenteTitulos ?? POR_DEFECTO.fuenteTitulos,
    fuenteTexto: fuenteTexto ?? POR_DEFECTO.fuenteTexto,
    actualizadoEn: new Date().toISOString(), actualizadoPor: usuario };
  fs.mkdirSync(path.dirname(archivo()), { recursive: true });
  fs.writeFileSync(archivo(), JSON.stringify(t, null, 2));
  enMemoria = t;
  return t;
}

export const restablecer = (usuario) => guardar(POR_DEFECTO, usuario);
