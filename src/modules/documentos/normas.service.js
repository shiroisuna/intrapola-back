import fs from 'node:fs';
import path from 'node:path';
import { badRequest, HttpError, notFound } from '../../utils/http.js';
import { invalidate } from '../../utils/cache.js';

/*
 * Normas: los PDF viven en una carpeta del servidor (NORMAS_DIR, por defecto assets/normas).
 * El nombre del archivo es el título que se muestra ("Código de ética.pdf" → "Código de ética").
 * Al eliminar desde el panel, el archivo se mueve a _eliminadas/ (no se borra).
 */
const dir = () => path.resolve(process.env.NORMAS_DIR || 'assets/normas');
const PAPELERA = '_eliminadas';

/** Título → nombre de archivo válido en Windows. */
export function nombreArchivo(titulo) {
  const limpio = String(titulo)
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 150);
  if (!limpio) throw badRequest('Indique un nombre para la norma');
  return `${limpio}.pdf`;
}

/** Ruta segura de un archivo dentro de la carpeta (sin ../). */
function ruta(archivo) {
  const nombre = path.basename(String(archivo));
  if (nombre !== archivo || !/\.pdf$/i.test(nombre)) throw notFound('La norma no existe');
  return path.join(dir(), nombre);
}

export function listar() {
  const d = dir();
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.pdf$/i.test(e.name))
    .map((e) => {
      const st = fs.statSync(path.join(d, e.name));
      return {
        id: e.name,
        titulo: e.name.replace(/\.pdf$/i, ''),
        descripcion: null,
        archivoUrl: `/api/documentos/normas/archivo/${encodeURIComponent(e.name)}`,
        tamano: st.size,
        publicadoEn: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base', numeric: true }));
}

export function archivo(nombre) {
  const r = ruta(nombre);
  if (!fs.existsSync(r)) throw notFound('La norma no existe o fue retirada');
  return r;
}

const limpiarCache = () => invalidate('doc:NORMA');

/**
 * Guarda uno o varios PDF. Con un solo archivo se puede indicar el título;
 * si no, se usa el nombre original. reemplazar=true sobrescribe una norma con el mismo nombre.
 */
export function guardar(files, { titulo, reemplazar }) {
  if (!files?.length) throw badRequest('Seleccione al menos un PDF');
  fs.mkdirSync(dir(), { recursive: true });
  const nombres = files.map((f, i) => nombreArchivo(files.length === 1 && titulo ? titulo : (f.originalname || `norma-${i + 1}`)));
  const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  if (repetidos.length) throw badRequest(`Hay archivos con el mismo nombre: ${repetidos.join(', ')}`);
  const existentes = nombres.filter((n) => fs.existsSync(path.join(dir(), n)));
  if (existentes.length && !reemplazar) {
    throw new HttpError(409, `Ya existe una norma con ese nombre: ${existentes.map((n) => n.replace(/\.pdf$/i, '')).join(', ')}. Marque "reemplazar" para sustituirla.`,
      existentes.map((n) => ({ campo: 'archivo', mensaje: n })));
  }
  const invalido = files.find((f) => f.buffer.subarray(0, 5).toString() !== '%PDF-');
  if (invalido) throw badRequest(`${invalido.originalname} no es un PDF válido`);
  files.forEach((f, i) => fs.writeFileSync(path.join(dir(), nombres[i]), f.buffer));
  limpiarCache();
  return listar();
}

export function renombrar(actual, nuevoTitulo) {
  const origen = archivo(actual);
  const nuevo = nombreArchivo(nuevoTitulo);
  const destino = path.join(dir(), nuevo);
  if (nuevo.toLowerCase() !== actual.toLowerCase() && fs.existsSync(destino)) throw new HttpError(409, `Ya existe una norma llamada "${nuevo.replace(/\.pdf$/i, '')}"`);
  fs.renameSync(origen, destino);
  limpiarCache();
  return listar();
}

export function retirar(nombre) {
  const origen = archivo(nombre);
  const papelera = path.join(dir(), PAPELERA);
  fs.mkdirSync(papelera, { recursive: true });
  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  fs.renameSync(origen, path.join(papelera, `${sello} ${path.basename(origen)}`));
  limpiarCache();
  return listar();
}
