import fs from 'node:fs';
import path from 'node:path';
import { C, MARGEN, ALTO_FIRMAS, nuevoDocumento, filaCampos, campo, firmas, pie, fechaCorta } from '../../utils/pdf.js';
import { EMPRESA as EMPRESA_INICIAL } from '../contenido/contenido.constantes.js';
import { leerDatos } from '../../utils/datosJson.js';
// Datos editables desde el panel (Empresa)
const empresa = () => leerDatos('empresa', EMPRESA_INICIAL);

const LOGO = path.resolve('assets/logo.png');

/** Encabezado tipo formato controlado (código, revisión y fechas), como el de la Intrapola actual. */
function encabezadoFormato(doc, f) {
  const W = doc.ancho;
  doc.rect(0, 0, doc.page.width, 6).fill(C.pino);
  const y = 26;
  const h = 64;
  const anchoIzq = 150;
  const anchoDer = 160;
  doc.rect(MARGEN, y, W, h).lineWidth(0.8).strokeColor(C.tinta).stroke();
  doc.moveTo(MARGEN + anchoIzq, y).lineTo(MARGEN + anchoIzq, y + h).stroke();
  doc.moveTo(MARGEN + W - anchoDer, y).lineTo(MARGEN + W - anchoDer, y + h).stroke();

  if (fs.existsSync(LOGO)) doc.image(LOGO, MARGEN + 8, y + 6, { fit: [30, 30] });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.tinta)
    .text(empresa().nombre, MARGEN + 4, y + 38, { width: anchoIzq - 8, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).text(`RIF ${empresa().rif}`, MARGEN + 4, y + 50, { width: anchoIzq - 8, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(10).text(f.titulo.toUpperCase(), MARGEN + anchoIzq + 10, y + 24, { width: W - anchoIzq - anchoDer - 20, align: 'center' });

  const filas = [['Fecha elab.', f.fechaElaboracion], ['Rev.', f.revision], ['Fecha rev.', f.fechaRevision], ['Código', f.codigo]];
  const xD = MARGEN + W - anchoDer;
  filas.forEach(([k, v], i) => {
    const yy = y + i * (h / 4);
    if (i) doc.moveTo(xD, yy).lineTo(MARGEN + W, yy).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(k, xD + 6, yy + 5);
    doc.font('Helvetica-Bold').fillColor(C.tinta).text(v, xD + 60, yy + 5, { width: anchoDer - 66, align: 'right' });
  });
  return y + h + 16;
}

export function hojaEvaluacion(d) {
  const doc = nuevoDocumento(`${d.formato.codigo} · ${d.contrato}`);
  const W = doc.ancho;
  let y = encabezadoFormato(doc, d.formato);

  y += filaCampos(doc, y, [
    { etiqueta: 'Proveedor', valor: d.proveedor },
    { etiqueta: 'RIF', valor: d.rif },
    { etiqueta: 'Código', valor: d.codigo },
  ]) + 6;
  y += filaCampos(doc, y, [
    { etiqueta: 'Fecha de evaluación', valor: fechaCorta(d.fecha) },
    { etiqueta: d.numeroAutomatico ? 'N.º de evaluación' : 'Contrato / orden N.º', valor: d.contrato },
    ...(d.numeroAutomatico ? [] : [{ etiqueta: 'Documento factura', valor: d.factura }]),
  ]) + 6;
  // Datos propios de cada evaluación (tipo de servicio, material, cantidades, lote...), de a tres por fila
  for (let i = 0; i < d.extras.length; i += 3) {
    const fila = d.extras.slice(i, i + 3);
    y += (fila.length === 1
      ? campo(doc, { x: MARGEN, y, w: W, ...fila[0], minAlto: 24 })
      : filaCampos(doc, y, fila)) + 4;
  }
  y += 8;

  /* ---- Criterios ---- */
  const col = { cumple: 58, max: 52, pts: 52 };
  col.texto = W - col.cumple - col.max - col.pts;
  const xs = { texto: MARGEN, cumple: MARGEN + col.texto, max: MARGEN + col.texto + col.cumple, pts: MARGEN + col.texto + col.cumple + col.max };
  const cabecera = (titulo) => {
    doc.rect(MARGEN, y, W, 20).fill(C.salviaClaro);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.pino).text(titulo, xs.texto + 6, y + 6, { width: col.texto - 12, lineBreak: false });
    doc.text('Cumple', xs.cumple, y + 6, { width: col.cumple, align: 'center' })
      .text('Máx.', xs.max, y + 6, { width: col.max, align: 'center' })
      .text('Puntos', xs.pts, y + 6, { width: col.pts - 6, align: 'right' });
    y += 20;
  };
  for (const s of d.secciones) {
    if (y + 60 > doc.page.height - 90) { pie(doc); doc.addPage(); y = MARGEN; }
    cabecera(s.nombre);
    for (const p of s.preguntas) {
      doc.font('Helvetica').fontSize(8.5);
      const alto = Math.max(17, doc.heightOfString(p.texto, { width: col.texto - 12 }) + 7);
      if (y + alto > doc.page.height - 90) { pie(doc); doc.addPage(); y = MARGEN; cabecera(s.nombre); }
      doc.font('Helvetica').fontSize(8.5).fillColor(C.tinta).text(p.texto, xs.texto + 6, y + 4, { width: col.texto - 12 });
      doc.font('Helvetica-Bold').fillColor(p.cumple === false ? '#9b2c2c' : C.pino)
        .text(p.cumple == null ? '—' : p.cumple ? 'Sí' : 'No', xs.cumple, y + 4, { width: col.cumple, align: 'center' });
      doc.font('Helvetica').fillColor(C.gris).text(String(p.max), xs.max, y + 4, { width: col.max, align: 'center' });
      doc.font('Helvetica-Bold').fillColor(C.tinta).text(p.puntos == null ? '—' : String(p.puntos), xs.pts, y + 4, { width: col.pts - 6, align: 'right' });
      y += alto;
      doc.moveTo(MARGEN, y).lineTo(MARGEN + W, y).lineWidth(0.5).strokeColor(C.linea).stroke();
    }
    y += 4;
  }

  /* ---- Resultado (con el evaluador, para que todo quepa en una hoja) ---- */
  if (y + 100 > doc.page.height - 80) { pie(doc); doc.addPage(); y = MARGEN; }
  y += 4;
  doc.roundedRect(MARGEN, y, W, 50, 6).fill(C.salviaClaro);
  const etq = (t, x) => doc.font('Helvetica').fontSize(7.5).fillColor(C.gris).text(t, x, y + 9, { characterSpacing: 0.4 });
  etq('PUNTUACIÓN TOTAL', MARGEN + 12);
  doc.font('Helvetica-Bold').fontSize(19).fillColor(C.pino).text(`${d.puntuacion} / ${d.maximo}`, MARGEN + 12, y + 21);
  etq('RESULTADO', MARGEN + 130);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.tinta).text(d.calificacion, MARGEN + 130, y + 21);
  doc.font('Helvetica').fontSize(8).fillColor(C.tinta).text(d.resultado || d.decision, MARGEN + 130, y + 35, { width: 190, lineBreak: false, ellipsis: true });
  etq('EVALUADO POR', MARGEN + 335);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.tinta).text(d.evaluador || '—', MARGEN + 335, y + 21, { width: W - 347, lineBreak: false, ellipsis: true });
  doc.font('Helvetica').fontSize(8).text([d.cargo, d.departamento].filter(Boolean).join(' · '), MARGEN + 335, y + 35, { width: W - 347, lineBreak: false, ellipsis: true });
  y += 58;

  if (d.observaciones) {
    if (y + 50 > doc.page.height - 80) { pie(doc); doc.addPage(); y = MARGEN; }
    y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Observaciones y sugerencias', valor: d.observaciones, minAlto: 24 }) + 4;
  }

  const ESPACIO = 34;
  if (y + ESPACIO > doc.page.height - ALTO_FIRMAS) { pie(doc); doc.addPage(); y = MARGEN; }
  firmas(doc, ['Evaluado por', 'Gerencia de Compras'], y + ESPACIO);
  pie(doc);
  return doc;
}
