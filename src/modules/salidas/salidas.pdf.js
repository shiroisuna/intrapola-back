import { C, MARGEN, ALTO_FIRMAS, nuevoDocumento, encabezado, seccion, filaCampos, campo, firmas, pie, fechaCorta } from '../../utils/pdf.js';

export function hojaSalida(d) {
  const doc = nuevoDocumento(`Autorización de salida N.º ${d.numero}`);
  const W = doc.ancho;

  let y = encabezado(doc, {
    area: 'Seguridad interna',
    numero: d.numero,
    etiquetaNumero: 'N.º de salida',
    titulo: 'Autorización de salida',
    subtitulo: 'Salida de materiales y equipos de la planta. Presente esta hoja firmada en la caseta de seguridad.',
  });

  y = seccion(doc, 'Autorización', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Autorizado por', valor: d.solicitante },
    { etiqueta: 'Departamento', valor: d.departamento },
    { etiqueta: 'Fecha de solicitud', valor: fechaCorta(d.fechaElaboracion) },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Fecha de salida', valor: fechaCorta(d.fechaSalida) },
    { etiqueta: '¿Retorna?', valor: d.retorna ? 'Sí' : 'No' },
    { etiqueta: 'Fecha estimada de retorno', valor: d.fechaRetorno ? fechaCorta(d.fechaRetorno) : '—' },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Persona o empresa que retira', valor: d.retira },
    { etiqueta: 'Cédula / RIF', valor: d.cedulaRetira },
  ]) + 20;

  /* ---- Materiales ---- */
  y = seccion(doc, 'Materiales y equipos', y);
  const col = { n: 28, cant: 80 };
  col.desc = W - col.n - col.cant;
  const xs = { n: MARGEN, desc: MARGEN + col.n, cant: MARGEN + W - col.cant };
  const cabecera = () => {
    doc.rect(MARGEN, y, W, 22).fill(C.salviaClaro);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.pino)
      .text('#', xs.n + 8, y + 7).text('Descripción', xs.desc, y + 7)
      .text('Cantidad', xs.cant, y + 7, { width: col.cant - 8, align: 'right' });
    y += 22;
  };
  cabecera();
  d.items.forEach((it, i) => {
    doc.font('Helvetica').fontSize(10);
    const alto = Math.max(22, doc.heightOfString(it.descripcion, { width: col.desc - 8 }) + 12);
    if (y + alto > doc.page.height - 90) { pie(doc); doc.addPage(); y = MARGEN; cabecera(); }
    doc.font('Helvetica').fontSize(10).fillColor(C.gris).text(String(i + 1), xs.n + 8, y + 6);
    doc.fillColor(C.tinta).text(it.descripcion, xs.desc, y + 6, { width: col.desc - 8 });
    doc.font('Helvetica-Bold').text(it.cantidad, xs.cant, y + 6, { width: col.cant - 8, align: 'right' });
    y += alto;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + W, y).lineWidth(0.5).strokeColor(C.linea).stroke();
  });
  y += 14;

  if (d.observacion) {
    if (y + 60 > doc.page.height - 80) { pie(doc); doc.addPage(); y = MARGEN; }
    y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Observación', valor: d.observacion }) + 8;
  }

  const ESPACIO = 40;
  if (y + ESPACIO > doc.page.height - ALTO_FIRMAS) { pie(doc); doc.addPage(); y = MARGEN; }
  firmas(doc, ['Autorizado por', 'Retirado por', 'Recibido Seguridad Interna'], y + ESPACIO);
  pie(doc);
  return doc;
}
