import { C, MARGEN, ALTO_FIRMAS, nuevoDocumento, encabezado, seccion, filaCampos, campo, firmas, pie } from '../../utils/pdf.js';

const FILA = 18;
const ANCHO_ETIQUETA = 92;

/**
 * Casillas en columnas, marcadas con una X. Con "etiqueta", esta va a la izquierda de la fila
 * (ahorra espacio para que la hoja quepa en una página). Devuelve la altura usada.
 */
function casillas(doc, y, items, { columnas = 3, etiqueta } = {}) {
  const x0 = MARGEN + (etiqueta ? ANCHO_ETIQUETA : 0);
  const ancho = (doc.ancho - (x0 - MARGEN)) / columnas;
  if (etiqueta) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.gris).text(etiqueta.toUpperCase(), MARGEN, y + 2, { width: ANCHO_ETIQUETA - 8, characterSpacing: 0.4 });
  }
  items.forEach((it, i) => {
    const x = x0 + (i % columnas) * ancho;
    const yy = y + Math.floor(i / columnas) * FILA;
    doc.rect(x, yy, 10, 10).lineWidth(0.8).strokeColor(C.tinta).stroke();
    if (it.marcado) {
      doc.moveTo(x + 2, yy + 2).lineTo(x + 8, yy + 8).moveTo(x + 8, yy + 2).lineTo(x + 2, yy + 8).lineWidth(1.4).strokeColor(C.pino).stroke();
    }
    doc.font(it.marcado ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(it.marcado ? C.tinta : C.gris)
      .text(it.texto, x + 16, yy + 1, { width: ancho - 20, lineBreak: false });
  });
  return Math.ceil(items.length / columnas) * FILA;
}

/**
 * Formulario de ingreso, modificación o egreso de usuario.
 * d: { id, fecha, solicitante, departamento, usuario, cedulaUsuario, cargo,
 *      comunicacion: [{grupo, opciones:[{nombre, marcado}]}], sap: [{nombre, marcado}], spi: [...],
 *      otros: [{nombre, marcado}] | null, observaciones }
 */
export function hojaUsuarios(d) {
  const doc = nuevoDocumento(`Solicitud de usuario N.º ${d.id}`);
  const W = doc.ancho;
  const salto = (alto) => {
    if (y + alto > doc.page.height - 80) { pie(doc); doc.addPage(); y = MARGEN; }
  };

  let y = encabezado(doc, {
    area: 'Departamento de Sistemas',
    numero: d.id,
    titulo: 'Solicitud de usuario',
    subtitulo: 'Formulario de ingreso, modificación o egreso de usuario. Debe ser firmado por el jefe del área solicitante.',
  });

  y = seccion(doc, 'Solicitante', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Solicitado por', valor: d.solicitante },
    { etiqueta: 'Departamento', valor: d.departamento },
    { etiqueta: 'Fecha de solicitud', valor: d.fecha },
  ]) + 18;

  y = seccion(doc, 'Datos del usuario', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Nombres y apellidos', valor: d.usuario },
    { etiqueta: 'Cédula de identidad', valor: d.cedulaUsuario },
    { etiqueta: 'Cargo', valor: d.cargo },
  ]) + 12;
  y += casillas(doc, y, [
    { texto: 'Creación de usuario', marcado: true },
    { texto: 'Modificación de usuario', marcado: false },
    { texto: 'Egreso de usuario', marcado: false },
  ], { etiqueta: 'Solicitud' }) + 14;

  const marcas = (xs) => xs.map((o) => ({ texto: o.nombre, marcado: o.marcado }));
  salto(30 + d.comunicacion.length * FILA);
  y = seccion(doc, 'Necesidades de comunicación', y);
  for (const g of d.comunicacion) y += casillas(doc, y, marcas(g.opciones), { etiqueta: g.grupo }) + 2;
  y += 10;

  salto(30 + 6 * FILA);
  y = seccion(doc, 'Necesidades de sistemas', y);
  y += casillas(doc, y, marcas(d.sap), { etiqueta: 'SAP' }) + 4;
  y += casillas(doc, y, marcas(d.spi), { etiqueta: 'SPI' }) + 4;
  if (d.otros) y += casillas(doc, y, marcas(d.otros), { etiqueta: 'Otros sistemas' }) + 4;

  if (d.observaciones) {
    y += 6;
    salto(60);
    y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Recursos especiales / observaciones', valor: d.observaciones }) + 8;
  }

  const ESPACIO = 30;
  if (y + ESPACIO > doc.page.height - ALTO_FIRMAS) { pie(doc); doc.addPage(); y = MARGEN; }
  firmas(doc, ['Jefe del área solicitante', 'Departamento de Sistemas'], y + ESPACIO);
  pie(doc);
  return doc;
}
