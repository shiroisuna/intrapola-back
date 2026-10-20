import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { EMPRESA as EMPRESA_INICIAL } from '../modules/contenido/contenido.constantes.js';
import { leerDatos } from './datosJson.js';
// Datos editables desde el panel (Empresa)
const empresa = () => leerDatos('empresa', EMPRESA_INICIAL);

/*
 * Piezas comunes de las hojas PDF de la Intrapola (permiso, papelería, ...).
 * Tamaño carta. Logo opcional en backend/assets/logo.png.
 */
export const C = {
  pino: '#1f4a33',
  salvia: '#bcdbc2',
  salviaClaro: '#f1f7f2',
  linea: '#cfdcd2',
  tinta: '#17231c',
  gris: '#5a6b61',
};
const LOGO = path.resolve('assets/logo.png');
export const MARGEN = 48;

export function nuevoDocumento(tituloDoc) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGEN, left: MARGEN, right: MARGEN, bottom: 10 }, // el pie se dibuja a mano
    info: { Title: tituloDoc, Author: empresa().nombre },
  });
  doc.ancho = doc.page.width - MARGEN * 2;
  return doc;
}

export const fechaCorta = (valor) => {
  if (!valor) return '—';
  const iso = valor instanceof Date ? valor.toISOString() : String(valor);
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export const fechaHoraActual = () =>
  new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Banda superior, logo, empresa, área y recuadro con el número. Devuelve la Y siguiente. */
export function encabezado(doc, { area, numero, etiquetaNumero = 'N.º de solicitud', rellenar = true, titulo, subtitulo }) {
  const X = MARGEN;
  doc.rect(0, 0, doc.page.width, 6).fill(C.pino);
  let xTexto = X;
  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, X, 30, { fit: [54, 54] });
    xTexto = X + 66;
  }
  doc.font('Helvetica-Bold').fontSize(15).fillColor(C.tinta).text(empresa().nombre, xTexto, 34);
  doc.font('Helvetica').fontSize(8.5).fillColor(C.gris)
    .text(`RIF ${empresa().rif}`, xTexto, 54)
    .text(area, xTexto, 66);

  const anchoCaja = 150;
  const xCaja = X + doc.ancho - anchoCaja;
  doc.roundedRect(xCaja, 28, anchoCaja, 58, 6).fill(C.salviaClaro);
  doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(etiquetaNumero.toUpperCase(), xCaja + 12, 37, { characterSpacing: 0.4 });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.pino).text(rellenar ? String(numero).padStart(6, '0') : String(numero), xCaja + 12, 48);
  doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(`Emitida: ${fechaHoraActual()}`, xCaja + 12, 71);

  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.tinta).text(titulo, X, 110);
  if (subtitulo) doc.font('Helvetica').fontSize(9.5).fillColor(C.gris).text(subtitulo, X, 136, { width: doc.ancho });
  return 172;
}

/** Título de sección con línea. Devuelve la Y siguiente. */
export function seccion(doc, texto, y) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.pino).text(texto, MARGEN, y);
  doc.moveTo(MARGEN, y + 16).lineTo(MARGEN + doc.ancho, y + 16).lineWidth(1.2).strokeColor(C.salvia).stroke();
  return y + 26;
}

/** Campo con etiqueta y valor en recuadro. Devuelve la altura usada. */
export function campo(doc, { x, y, w, etiqueta, valor, minAlto = 30 }) {
  doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(etiqueta.toUpperCase(), x, y, { width: w, characterSpacing: 0.4 });
  const texto = valor === null || valor === undefined || valor === '' ? '—' : String(valor);
  doc.font('Helvetica').fontSize(10.5);
  const alto = Math.max(minAlto, doc.heightOfString(texto, { width: w - 16 }) + 14);
  doc.roundedRect(x, y + 11, w, alto, 4).lineWidth(0.8).strokeColor(C.linea).stroke();
  doc.fillColor(C.tinta).text(texto, x + 8, y + 18, { width: w - 16 });
  return alto + 11;
}

/** Fila de campos del mismo ancho. Devuelve la altura de la fila. */
export function filaCampos(doc, y, campos) {
  const gap = 16;
  const w = (doc.ancho - gap * (campos.length - 1)) / campos.length;
  return Math.max(...campos.map((c, i) => campo(doc, { ...c, x: MARGEN + i * (w + gap), y, w })));
}

/** Altura mínima libre que necesitan las firmas sobre el pie. */
export const ALTO_FIRMAS = 95; // línea de firma + rol + "Firma y fecha" (≈30) + separación del pie

/** Líneas de firma: hacia el final de la hoja, o justo debajo del contenido si este llega más abajo. */
export function firmas(doc, roles, yMin) {
  const y = Math.min(Math.max(yMin, doc.page.height - 190), doc.page.height - ALTO_FIRMAS);
  const ancho = (doc.ancho - 24 * (roles.length - 1)) / roles.length;
  roles.forEach((rol, i) => {
    const fx = MARGEN + i * (ancho + 24);
    doc.moveTo(fx, y).lineTo(fx + ancho, y).lineWidth(0.8).strokeColor(C.tinta).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.tinta).text(rol, fx, y + 6, { width: ancho, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text('Firma y fecha', fx, y + 19, { width: ancho, align: 'center' });
  });
}

export function pie(doc) {
  const y = doc.page.height - 60;
  doc.moveTo(MARGEN, y).lineTo(MARGEN + doc.ancho, y).lineWidth(0.6).strokeColor(C.linea).stroke();
  doc.font('Helvetica').fontSize(7.5).fillColor(C.gris)
    .text(`${empresa().direccion}  ·  Tel. ${empresa().telefono}`, MARGEN, y + 8, { width: doc.ancho, lineBreak: false })
    .text('Generado por Intrapola — Departamento de Sistemas', MARGEN, y + 20, { width: doc.ancho, lineBreak: false });
}

/** Envía el PDF como respuesta HTTP (se abre en el navegador). */
export function enviarPdf(res, doc, nombreArchivo) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
  doc.pipe(res);
  doc.end();
}
