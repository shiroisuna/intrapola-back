import { C, MARGEN, ALTO_FIRMAS, nuevoDocumento, encabezado, seccion, filaCampos, campo, firmas, pie, fechaCorta } from '../../utils/pdf.js';

/**
 * Hoja de solicitud de papelería: datos del solicitante y tabla de artículos.
 * Si hay muchos artículos la tabla continúa en otra página con su encabezado.
 */
export function hojaPapeleria(d) {
  const doc = nuevoDocumento(`Solicitud de papelería N.º ${d.numero}`);
  const W = doc.ancho;

  let y = encabezado(doc, {
    area: 'Servicios Generales — Papelería',
    numero: d.numero,
    titulo: 'Solicitud de papelería',
    subtitulo: 'Material de oficina para el departamento. Debe ser autorizada por el supervisor y presentada al momento del despacho.',
  });

  y = seccion(doc, 'Solicitante', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Nombre y apellido', valor: d.nombre },
    { etiqueta: 'Cédula de identidad', valor: d.cedula },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Departamento', valor: d.departamento },
    { etiqueta: 'Cargo', valor: d.cargo },
    { etiqueta: 'Fecha de solicitud', valor: fechaCorta(d.fecha) },
  ]) + 22;

  /* ---------------- Tabla de artículos ---------------- */
  y = seccion(doc, 'Artículos solicitados', y);
  const col = { n: 28, codigo: 70, cant: 80 };
  col.articulo = W - col.n - col.codigo - col.cant;
  const xs = { n: MARGEN, codigo: MARGEN + col.n, articulo: MARGEN + col.n + col.codigo, cant: MARGEN + W - col.cant };

  const cabeceraTabla = () => {
    doc.rect(MARGEN, y, W, 22).fill(C.salviaClaro);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.pino);
    doc.text('#', xs.n + 8, y + 7, { width: col.n - 8 });
    doc.text('Código', xs.codigo, y + 7, { width: col.codigo });
    doc.text('Artículo', xs.articulo, y + 7, { width: col.articulo - 8 });
    doc.text('Cantidad', xs.cant, y + 7, { width: col.cant - 8, align: 'right' });
    y += 22;
  };
  cabeceraTabla();

  let total = 0;
  d.items.forEach((it, i) => {
    doc.font('Helvetica').fontSize(10);
    const alto = Math.max(22, doc.heightOfString(it.nombre, { width: col.articulo - 8 }) + 12);
    if (y + alto > doc.page.height - 90) { // salto de página
      pie(doc);
      doc.addPage();
      y = MARGEN;
      cabeceraTabla();
    }
    doc.font('Helvetica').fontSize(10).fillColor(C.gris).text(String(i + 1), xs.n + 8, y + 6, { width: col.n - 8 });
    doc.text(String(it.articuloId), xs.codigo, y + 6, { width: col.codigo });
    doc.fillColor(C.tinta).text(it.nombre, xs.articulo, y + 6, { width: col.articulo - 8 });
    doc.font('Helvetica-Bold').text(String(it.cantidad), xs.cant, y + 6, { width: col.cant - 8, align: 'right' });
    y += alto;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + W, y).lineWidth(0.5).strokeColor(C.linea).stroke();
    total += Number(it.cantidad) || 0;
  });

  // Totales
  doc.font('Helvetica').fontSize(9).fillColor(C.gris)
    .text(`${d.items.length} ${d.items.length === 1 ? 'artículo' : 'artículos'}`, xs.articulo, y + 8, { width: col.articulo - 8 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.tinta)
    .text(`Total: ${total} ${total === 1 ? 'unidad' : 'unidades'}`, xs.articulo, y + 8, { width: W - col.n - col.codigo - 8, align: 'right' });
  y += 30;

  if (d.observaciones) {
    doc.font('Helvetica').fontSize(10.5);
    const altoObs = Math.max(30, doc.heightOfString(d.observaciones, { width: W - 16 }) + 14) + 11;
    if (y + altoObs > doc.page.height - 70) { pie(doc); doc.addPage(); y = MARGEN; }
    y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Observaciones', valor: d.observaciones }) + 8;
  }

  // Firmas: si no caben, van en una página nueva
  const ESPACIO = 34; // aire entre el contenido y las líneas de firma
  if (y + ESPACIO > doc.page.height - ALTO_FIRMAS) { pie(doc); doc.addPage(); y = MARGEN; }
  firmas(doc, ['Solicitado por', 'Autorizado por', 'Despachado por'], y + ESPACIO);
  pie(doc);
  return doc;
}
