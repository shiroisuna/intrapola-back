import { MARGEN, nuevoDocumento, encabezado, seccion, filaCampos, campo, firmas, pie, fechaCorta } from '../../utils/pdf.js';

/** Hoja de solicitud de vacaciones (misma información que la de iTextSharp, ordenada). */
export function hojaVacaciones(d) {
  const doc = nuevoDocumento(`Solicitud de vacaciones ${d.cedula} ${d.inicio}`);
  const W = doc.ancho;

  let y = encabezado(doc, {
    area: 'Gerencia de Recursos Humanos',
    etiquetaNumero: 'Días de disfrute',
    numero: d.dias,
    rellenar: false,
    titulo: 'Solicitud de vacaciones',
    subtitulo: 'Debe ser firmada por el trabajador y el jefe de área, y entregada a Recursos Humanos.',
  });

  y = seccion(doc, 'Datos del trabajador', y);
  y += campo(doc, { x: MARGEN, y, w: W, etiqueta: 'Nombre del trabajador', valor: d.nombre }) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Cédula de identidad', valor: d.cedula },
    { etiqueta: 'Ficha', valor: d.ficha },
    { etiqueta: 'Fecha de ingreso', valor: fechaCorta(d.fechaIngreso) },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Departamento', valor: d.departamento },
    { etiqueta: 'Cargo', valor: d.cargo },
  ]) + 22;

  y = seccion(doc, 'Detalle de las vacaciones', y);
  y += filaCampos(doc, y, [
    { etiqueta: 'Fecha de solicitud', valor: fechaCorta(d.fechaSol) },
    { etiqueta: 'Período', valor: d.periodo },
    { etiqueta: 'Años de antigüedad', valor: d.antiguedad },
  ]) + 8;
  y += filaCampos(doc, y, [
    { etiqueta: 'Fecha de salida', valor: fechaCorta(d.inicio) },
    { etiqueta: 'Fecha de reintegro', valor: fechaCorta(d.fin) },
    { etiqueta: 'Días de disfrute', valor: d.dias },
  ]) + 8;

  firmas(doc, ['Trabajador', 'Jefe de área', 'Recursos Humanos'], y + 60);
  pie(doc);
  return doc;
}
