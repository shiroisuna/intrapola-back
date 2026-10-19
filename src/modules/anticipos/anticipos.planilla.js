import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import { env } from '../../config/env.js';
import { archivoPlanilla } from './anticipos.constantes.js';

/*
 * Planilla de abono de prestaciones que RRHH deja cada mes en su carpeta compartida
 * (EncontrarPaginaPorCedula + ExtraerPagina del C#):
 *   \\192.168.10.106\gr_rrhh$\Nóminas\Nominas Año {año}\Abonos de Prestaciones Sociales\{mes}\EMPLEADOS.pdf | OBREROS.pdf
 * Se busca la página del trabajador y se lee su "SALDO DISPONIBLE .75".
 * A diferencia del C#, la página no se copia a una carpeta pública: se entrega solo al trabajador con sesión.
 */

const ZONA = 'America/Caracas';
export const mesActual = () => new Date().toLocaleDateString('es-ES', { month: 'long', timeZone: ZONA }).toLowerCase();
const anioActual = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA }).slice(0, 4);

export function rutaPlanilla(idNomina) {
  const carpeta = env.anticipos.carpeta.replaceAll('{anio}', anioActual()).replaceAll('{mes}', mesActual());
  return path.join(carpeta, archivoPlanilla(idNomina));
}

/* Texto de cada página, en caché mientras el archivo no cambie (la planilla puede tener cientos de páginas). */
const cache = new Map(); // ruta → { mtime, buffer, paginas: string[] }

async function cargar(ruta) {
  const info = await fs.stat(ruta);
  const enCache = cache.get(ruta);
  if (enCache && enCache.mtime === info.mtimeMs) return enCache;

  const buffer = await fs.readFile(ruta);
  const pdf = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const contenido = await (await pdf.getPage(i)).getTextContent();
    paginas.push(contenido.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
  }
  await pdf.destroy();

  const entrada = { mtime: info.mtimeMs, buffer, paginas };
  cache.set(ruta, entrada);
  if (cache.size > 4) cache.delete(cache.keys().next().value);
  return entrada;
}

/**
 * "19999907" también como "19.999.907". Con bordes: no debe coincidir dentro de otra cédula
 * (1999990 en 19999907) ni dentro de un monto (1999990 en 1.999.990,50).
 */
function patronCedula(cedula) {
  const conPuntos = cedula.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const alt = [cedula, conPuntos].map((c) => c.replace(/\./g, '\\.')).join('|');
  return new RegExp(`(?<!\\d)(?<!\\d[.,])(?:${alt})(?!\\d)(?![.,]\\d)`);
}

/** Convierte "12.345,67" o "12,345.67" a número. */
export function aNumero(texto) {
  if (!texto) return null;
  let t = String(texto).replace(/[^\d.,-]/g, '');
  const ultimo = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
  if (ultimo !== -1 && /^\d{1,2}$/.test(t.slice(ultimo + 1))) {
    t = `${t.slice(0, ultimo).replace(/[.,]/g, '')}.${t.slice(ultimo + 1)}`; // separador decimal
  } else {
    t = t.replace(/[.,]/g, ''); // solo miles
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Busca al trabajador en la planilla del mes.
 * Devuelve { disponible, mes, archivo, pagina, saldo, saldoTexto, mensaje }.
 */
export async function buscarEnPlanilla({ cedula, idNomina }) {
  const ruta = rutaPlanilla(idNomina);
  const base = { mes: mesActual(), archivo: path.basename(ruta) };
  let datos;
  try {
    datos = await cargar(ruta);
  } catch (err) {
    console.warn(`[anticipos] planilla no disponible (${ruta}): ${err.code || err.message}`);
    return { ...base, disponible: false, mensaje: `La planilla de prestaciones de ${base.mes} todavía no está disponible.` };
  }

  const patron = patronCedula(String(cedula).trim());
  const indice = datos.paginas.findIndex((t) => patron.test(t));
  if (indice === -1) {
    return { ...base, disponible: false, mensaje: `Su cédula no aparece en la planilla de prestaciones de ${base.mes}.` };
  }

  const m = datos.paginas[indice].match(/SALDO\s+DISPONIBLE\s*\.75\s*:?\s*([\d.,]+)/i);
  return {
    ...base,
    disponible: true,
    pagina: indice + 1,
    saldoTexto: m?.[1] ?? null,
    saldo: aNumero(m?.[1]),
  };
}

/** PDF de una sola página: la del trabajador. */
export async function paginaPdf({ idNomina, pagina }) {
  const { buffer } = await cargar(rutaPlanilla(idNomina));
  const origen = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const salida = await PDFDocument.create();
  const [copia] = await salida.copyPages(origen, [pagina - 1]);
  salida.addPage(copia);
  return Buffer.from(await salida.save());
}
