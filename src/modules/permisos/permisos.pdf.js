import { C, MARGEN, nuevoDocumento, encabezado, seccion, filaCampos, campo, firmas, pie, fechaCorta } from '../../utils/pdf.js';
import { duracionTexto } from './permisos.constantes.js';

/**
 * Hoja de solicitud de permiso (carta, una página).
 * @param {object} d { id, fechaPermiso, nombre, ficha, cedula, departamento, cargo, nomina,
 *                     tipoPermiso, tiempo, medida, motivo, observaciones }
 */
export function hojaPermiso(d) {
  const doc = nuevoDocumento(`Solicitud de permiso N.º ${d.id}`);
  const W = doc.ancho;

  let y = encabezado(doc, {
    area: 'Gerencia de Recursos Humanos',
    numero: d.id,
    titulo: 'Solicitud de permiso',
    subtitulo: 'Ausencia individual por horas o días. Debe ser aprobada por el supervisor inmediato y entregada a Recursos Humanos.',
  });

  y = seccion(doc, 'Datos del trabajador', y);
  y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Nombre y apellido', valor: d.nombre }) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Cédula de identidad', valor: d.cedula },
    { etiqueta: 'Ficha', valor: d.ficha },
    { etiqueta: 'Nómina', valor: d.nomina },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Departamento', valor: d.departamento },
    { etiqueta: 'Cargo', valor: d.cargo },
  ]) + 22;

  y = seccion(doc, 'Detalle del permiso', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Fecha del permiso', valor: fechaCorta(d.fechaPermiso) },
    { etiqueta: 'Tipo de permiso', valor: d.tipoPermiso },
    { etiqueta: 'Duración', valor: duracionTexto(d.tiempo, d.medida) },
  ]) + 8;
  y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Motivo del permiso', valor: d.motivo, minAlto: 44 }) + 8;
  y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Observaciones', valor: d.observaciones, minAlto: 44 }) + 22;

  y = seccion(doc, 'Aprobación', y);
  // Casillas dibujadas (los caracteres ☐ no existen en la fuente estándar del PDF)
  [['Aprobado', 0], ['No aprobado', 110]].forEach(([txt, dx]) => {
    doc.rect(MARGEN + dx, y, 10, 10).lineWidth(0.8).strokeColor(C.tinta).stroke();
    doc.font('Helvetica').fontSize(9.5).fillColor(C.tinta).text(txt, MARGEN + dx + 16, y + 1);
  });

  firmas(doc, ['Trabajador', 'Supervisor inmediato', 'Recursos Humanos'], y + 60);
  pie(doc);
  return doc;
}
