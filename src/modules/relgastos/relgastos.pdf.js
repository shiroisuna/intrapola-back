import { C, MARGEN, ALTO_FIRMAS, nuevoDocumento, encabezado, seccion, filaCampos, campo, firmas, pie, fechaCorta } from '../../utils/pdf.js';

const bs = (n) => Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function hojaRelacionGastos(d) {
  const doc = nuevoDocumento(`Relación de gastos N.º ${d.numero}`);
  const W = doc.ancho;

  let y = encabezado(doc, {
    area: 'Administración',
    numero: d.numero,
    etiquetaNumero: 'N.º de relación',
    titulo: 'Relación de gastos',
    subtitulo: 'Gastos realizados con cargo a un anticipo. Anexe las facturas y entregue firmada a Administración.',
  });

  y = seccion(doc, 'Trabajador', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Nombre', valor: d.empleado },
    { etiqueta: 'Cédula de identidad', valor: d.cedula },
    { etiqueta: 'Fecha', valor: fechaCorta(d.fecha) },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Departamento', valor: d.departamento },
    { etiqueta: 'Concepto', valor: d.concepto },
  ]) + 20;

  /* ---- Detalle ---- */
  y = seccion(doc, 'Detalle de gastos', y);
  const col = { n: 28, fecha: 90, monto: 110 };
  col.tipo = W - col.n - col.fecha - col.monto;
  const xs = { n: MARGEN, fecha: MARGEN + col.n, tipo: MARGEN + col.n + col.fecha, monto: MARGEN + W - col.monto };
  const cabecera = () => {
    doc.rect(MARGEN, y, W, 22).fill(C.salviaClaro);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.pino);
    doc.text('#', xs.n + 8, y + 7).text('Fecha', xs.fecha, y + 7).text('Tipo de gasto', xs.tipo, y + 7)
      .text('Monto', xs.monto, y + 7, { width: col.monto - 8, align: 'right' });
    y += 22;
  };
  cabecera();
  d.gastos.forEach((g, i) => {
    if (y + 22 > doc.page.height - 90) { pie(doc); doc.addPage(); y = MARGEN; cabecera(); }
    doc.font('Helvetica').fontSize(10).fillColor(C.gris).text(String(i + 1), xs.n + 8, y + 6);
    doc.fillColor(C.tinta).text(fechaCorta(g.fecha), xs.fecha, y + 6)
      .text(g.tipo, xs.tipo, y + 6, { width: col.tipo - 8, lineBreak: false, ellipsis: true })
      .text(bs(g.monto), xs.monto, y + 6, { width: col.monto - 8, align: 'right' });
    y += 22;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + W, y).lineWidth(0.5).strokeColor(C.linea).stroke();
  });

  /* ---- Totales ---- */
  y += 10;
  if (y + 110 > doc.page.height - 80) { pie(doc); doc.addPage(); y = MARGEN; }
  const anchoTot = 280;
  const xTot = MARGEN + W - anchoTot;
  const fila = (etq, valor, fuerte) => {
    doc.font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 10.5 : 10).fillColor(fuerte ? C.pino : C.tinta)
      .text(etq, xTot, y, { width: anchoTot - 100, lineBreak: false })
      .text(bs(valor), xTot + anchoTot - 100, y, { width: 100 - 8, align: 'right' });
    y += 18;
  };
  const yIni = y;
  fila('Anticipo recibido', d.anticipo);
  fila('Total gastos', d.totalGasto);
  doc.moveTo(xTot, y - 3).lineTo(xTot + anchoTot, y - 3).lineWidth(0.8).strokeColor(C.linea).stroke();
  y += 3;
  fila('Saldo a favor de la empresa', d.saldoEmpresa, d.saldoEmpresa > 0);
  fila('Saldo a favor del trabajador', d.saldoEmpleado, d.saldoEmpleado > 0);

  if (d.observaciones) {
    const yObs = yIni;
    campo(doc, { x: MARGEN, y: yObs, w: W - anchoTot - 20, etiqueta: 'Observaciones', valor: d.observaciones, minAlto: 58 });
  }

  const ESPACIO = 40;
  if (y + ESPACIO > doc.page.height - ALTO_FIRMAS) { pie(doc); doc.addPage(); y = MARGEN; }
  firmas(doc, ['Firma del solicitante', 'Recibido (fecha)', 'Aprobado por'], y + ESPACIO);
  pie(doc);
  return doc;
}
