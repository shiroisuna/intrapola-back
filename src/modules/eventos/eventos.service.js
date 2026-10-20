import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { badRequest, notFound } from '../../utils/http.js';
import { invalidate } from '../../utils/cache.js';
import * as repo from './eventos.repository.js';

/*
 * Galerías de eventos creadas desde el panel:
 *   uploads/eventos/<id>/portada-xxx.jpg
 *   uploads/eventos/<id>/fotos/*.jpg
 * Las imágenes llegan a uploads/eventos/_tmp (multer) y aquí se mueven a su carpeta.
 */
const RAIZ = () => path.resolve(env.uploadsDir, 'eventos');
const carpeta = (id) => path.join(RAIZ(), String(id));
const carpetaFotos = (id) => path.join(carpeta(id), 'fotos');
const IMAGEN = /\.(png|jpe?g|webp|gif)$/i;

function mover(file, destino, nombre = file.filename) {
  fs.mkdirSync(destino, { recursive: true });
  const final = path.join(destino, nombre);
  fs.renameSync(file.path, final);
  return nombre;
}
export const descartar = (files = []) => files.forEach((f) => fs.rm(f.path, { force: true }, () => {}));

function fotosDe(id) {
  const dir = carpetaFotos(id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => IMAGEN.test(n))
    .sort()
    .map((n) => ({ archivo: n, url: `${repo.PREFIJO}${id}/fotos/${encodeURIComponent(n)}` }));
}

const limpiarCache = () => invalidate('eventos:');

/** Galería pública: solo eventos visibles creados en el panel. */
export async function galeria(id) {
  const e = await repo.obtener(id);
  if (!e || !e.activo) throw notFound('El evento no existe o ya no está publicado');
  return { ...e, fotos: e.galeria ? fotosDe(id) : [] };
}

export async function detalleAdmin(id) {
  const e = await repo.obtener(id);
  if (!e) throw notFound('El evento no existe');
  return { ...e, fotos: e.galeria ? fotosDe(id) : [] };
}

/** Crea el evento con portada y fotos. Si algo falla, no deja la fila ni los archivos a medias. */
export async function crear({ titulo, activo }, portada, fotos = []) {
  if (!portada) { descartar(fotos); throw badRequest('Agregue la foto de portada', [{ campo: 'portada', mensaje: 'Agregue la foto de portada' }]); }
  let id;
  try {
    id = await repo.crear(titulo);
    const nombre = mover(portada, carpeta(id), `portada-${portada.filename}`);
    fotos.forEach((f) => mover(f, carpetaFotos(id)));
    const ev = await repo.actualizar(id, {
      img: `${repo.PREFIJO}${id}/${nombre}`,
      url: `${repo.PREFIJO}${id}/`,
      activo,
    });
    limpiarCache();
    return { ...ev, fotos: fotosDe(id) };
  } catch (err) {
    descartar([portada, ...fotos]);
    if (id) {
      await repo.eliminar(id).catch(() => {});
      fs.rmSync(carpeta(id), { recursive: true, force: true });
    }
    throw err;
  }
}

export async function actualizar(id, { titulo, activo }, portada) {
  const e = await repo.obtener(id);
  if (!e) { descartar([portada].filter(Boolean)); throw notFound('El evento no existe'); }
  const cambios = { titulo, activo };
  if (portada) {
    if (!e.galeria) {
      descartar([portada]);
      throw badRequest('La portada de los eventos de la Intrapola anterior no se puede cambiar desde aquí');
    }
    // Se borra la portada anterior
    for (const n of fs.existsSync(carpeta(id)) ? fs.readdirSync(carpeta(id)) : []) {
      if (n.startsWith('portada-')) fs.rmSync(path.join(carpeta(id), n), { force: true });
    }
    cambios.img = `${repo.PREFIJO}${id}/${mover(portada, carpeta(id), `portada-${portada.filename}`)}`;
  }
  const ev = await repo.actualizar(id, cambios);
  limpiarCache();
  return { ...ev, fotos: ev.galeria ? fotosDe(id) : [] };
}

export async function agregarFotos(id, fotos) {
  const e = await repo.obtener(id);
  if (!e || !e.galeria) {
    descartar(fotos);
    throw e ? badRequest('Este evento es de la Intrapola anterior: sus fotos están en el IIS') : notFound('El evento no existe');
  }
  if (!fotos.length) throw badRequest('Seleccione al menos una foto');
  fotos.forEach((f) => mover(f, carpetaFotos(id)));
  return fotosDe(id);
}

export function quitarFoto(id, archivo) {
  const nombre = path.basename(archivo); // evita rutas como ../../
  const ruta = path.join(carpetaFotos(id), nombre);
  if (!IMAGEN.test(nombre) || !fs.existsSync(ruta)) throw notFound('La foto no existe');
  fs.rmSync(ruta, { force: true });
  return fotosDe(id);
}

/** Eventos del panel: se borran (fila y carpeta). Los de la Intrapola anterior solo se ocultan. */
export async function eliminar(id) {
  const e = await repo.obtener(id);
  if (!e) throw notFound('El evento no existe');
  if (!e.galeria) {
    await repo.actualizar(id, { activo: false });
  } else {
    await repo.eliminar(id);
    fs.rmSync(carpeta(id), { recursive: true, force: true });
  }
  limpiarCache();
}

export const listarAdmin = () => repo.todos();
