/*
 * Encuestas de evaluación de proveedores. Cada pregunta tiene:
 *   texto → lo que ve el evaluador
 *   valor → texto EXACTO que guarda la Intrapola actual en det_evalprov (las etiquetas del .aspx),
 *           para no romper los reportes que agrupan por pregunta
 *   max   → puntos máximos
 * campos → datos de cabecera propios de cada evaluación (se dibujan en el paso "Proveedor"):
 *   nombre, etiqueta, tipo (texto | numero | email | select | auto), requerido, opciones
 *   y van a cab_evalprov según la posición que les da el C# (ver evaluaciones.repository.js).
 */
export const EVALUACIONES = {
  servicios: {
    tipo: 'SERVICIOS', // cab_evalprov: tipo de evaluación
    titulo: 'Evaluación de proveedores de servicios',
    formato: { codigo: 'FO-CO-004', revision: '1', fechaElaboracion: '26/10/2018', fechaRevision: '09/01/2020', titulo: 'Criterios de evaluación de proveedores de servicios' },
    campos: [
      { nombre: 'contrato', etiqueta: 'Contrato u orden N.º', tipo: 'texto', requerido: true, max: 50 },
      { nombre: 'factura', etiqueta: 'Documento factura', tipo: 'texto', max: 50 },
      { nombre: 'descripcion', etiqueta: 'Tipo de servicio ejecutado', tipo: 'texto', requerido: true, max: 300, ancho: 'completo', ayuda: 'Ej. Mantenimiento preventivo de compresores' },
    ],
    secciones: [
      {
        nombre: 'Calidad del Servicio',
        preguntas: [
          { texto: 'Contó con la logística necesaria en cuanto a transporte, equipos y herramientas menores para cumplir con el objeto del contrato.', valor: 'Conto con la logistica necesaria en cuanto transporte,equipos y herramientas menores para cumplir con el objeto del contrato.', max: 15 },
          { texto: 'Durante la ejecución del servicio contó con personal técnico calificado para cumplir las actividades propias del servicio.', valor: 'Durante la ejecución del servicio contó con personal tecnico calificado para cumplir la actividades propias del servicio', max: 20 },
          { texto: 'El servicio se prestó de acuerdo a lo pactado con el contratista o proveedor del servicio.', valor: 'El servicio se presto de acuerdo a lo pactado con el contratista o proveedor del servicio', max: 20 },
          { texto: 'Se contó con los equipos y herramientas adecuados para las tareas propias de la ejecución del servicio.', valor: 'se conto con los equipos y herramientas adecuados para las tareas propias de la ejecucion del servicio', max: 5 },
        ],
      },
      {
        nombre: 'Cumplimiento en los tiempos y Disponibilidad',
        preguntas: [
          { texto: 'Cuenta con la disposición para la ejecución del servicio.', valor: 'Cuenta con la disposición para la ejecucion del servicio', max: 5 },
          { texto: 'Cumplió con los tiempos pactados para la prestación del servicio.', valor: 'Cumplio con los tiempos pactado para la prestacion del servicio', max: 5 },
        ],
      },
      {
        nombre: 'Cumplimiento en Cantidad',
        preguntas: [
          { texto: 'Cumplió con la entrega de las cantidades y usos de los insumos según lo acordado.', valor: 'Cumplio con la entrega de las cantidades y usos de los insumos segun lo acordado', max: 10 },
        ],
      },
      {
        nombre: 'Servicio Durante y Postventa',
        preguntas: [
          { texto: 'Dio respuesta a los requerimientos o reclamos realizados.', valor: 'Dio Respuesta a los Requerimientos o reclamos realizados', max: 10 },
          { texto: 'La respuesta dada a los requerimientos realizados fue oportuna.', valor: 'La respuesta dada a los requerimientos realizados fue oportuna', max: 10 },
        ],
      },
    ],
  },

  mpme: {
    tipo: null, // cab_evalprov guarda el tipo de proveedor elegido (DropDownList2)
    titulo: 'Evaluación de proveedores MP / ME / MI / C',
    formato: { codigo: 'FO-CO-003', revision: '2', fechaElaboracion: '26/10/2018', fechaRevision: '09/01/2020', titulo: 'Criterios de evaluación de proveedores MP / ME / MI / C' },
    campos: [
      { nombre: 'tipoProveedor', etiqueta: 'Tipo de proveedor', tipo: 'select', requerido: true, opciones: ['Materia Prima', 'Material de Empaque', 'Material Indirecto', 'Consumible'] },
      { nombre: 'descripcion', etiqueta: 'Material suministrado', tipo: 'texto', requerido: true, max: 300, ancho: 'doble' },
      { nombre: 'cantSuministrada', etiqueta: 'Cantidad suministrada', tipo: 'numero', requerido: true },
      { nombre: 'cantRechazada', etiqueta: 'Cantidad rechazada', tipo: 'numero', requerido: true, porDefecto: '0' },
      { nombre: 'lote', etiqueta: 'Lote Amapola', tipo: 'texto', requerido: true, max: 50 },
      { nombre: 'contrato', etiqueta: 'Contrato u orden N.º', tipo: 'texto', requerido: true, max: 50 },
      { nombre: 'factura', etiqueta: 'Documento factura / NE', tipo: 'texto', requerido: true, max: 50 },
    ],
    secciones: [
      {
        nombre: 'Calidad del Producto',
        preguntas: [
          { texto: 'Cumplió con los documentos requeridos para la recepción de mercancía.', valor: 'Cumplio con los documentos requeridos para la recepcion de mercancia.', max: 10 },
          { texto: 'Cumplió con las especificaciones técnicas y de funcionalidad requeridas de acuerdo a la negociación y orden de compra.', valor: 'Cumplio con las especificaciones técnicas y de funcionalidad requeridas de acuerdo a la negociacion y orden de compra.', max: 30 },
          { texto: 'Los productos entregados estaban en buenas condiciones físicas y su apariencia satisface las expectativas.', valor: 'Los productos entregados estaban en buenas condiciones fisicas y su apariencia satisface las expectativas.', max: 10 },
          { texto: 'Los vehículos cumplen con las condiciones higiénicas requeridas y protecciones para la seguridad física del producto.', valor: 'Los vehiculos cumplen con las condiciones higienicas requeridas y protecciones para la seguridad fisica del producto.', max: 10 },
        ],
      },
    ],
  },
  transporte: {
    tipo: 'TRANSPORTE',
    titulo: 'Evaluación de proveedores de transporte (PT)',
    formato: { codigo: 'FO-CO-004', revision: '1', fechaElaboracion: '26/10/2018', fechaRevision: '09/01/2020', titulo: 'Criterios de evaluación de proveedores de servicios — Transporte' },
    // El número se arma solo: últimos 4 dígitos del código del proveedor + año (yy) + mes (MM): una evaluación por mes
    numeroAutomatico: true,
    notificarProveedor: true,
    campos: [
      { nombre: 'contrato', etiqueta: 'N.º de evaluación', tipo: 'auto', ayuda: 'Se genera con el código del proveedor y el mes' },
      { nombre: 'correo', etiqueta: 'Correo del proveedor', tipo: 'email', max: 150, ayuda: 'Le llegará el resultado de la evaluación' },
    ],
    secciones: [
      {
        nombre: 'Asegurabilidad del Traslado y Descarga del Producto',
        preguntas: [
          { texto: 'Cuenta con la unidad de transporte en óptimas condiciones.', valor: 'Cuenta con la unidad de transporte en optimas condiciones', max: 15 },
          { texto: 'Durante la carga / descarga de PT contó con el personal ayudante / caletero para agilizar el proceso.', valor: 'Durante la carga/ descarga de PT conto con el personal ayudante/ caletero para agilizar el proceso', max: 10 },
        ],
      },
      {
        nombre: 'Tiempo de Entrega / Cumplimiento',
        preguntas: [
          // En el .aspx la pregunta es "Presento retraso en la entrega"; "cumple" significa que NO hubo retraso
          { texto: 'No presentó retraso en la entrega.', valor: 'Presento retraso en la entrega', max: 25 },
        ],
      },
      {
        nombre: 'Comunicación Efectiva',
        preguntas: [
          { texto: 'Mantuvo una comunicación efectiva durante todo el servicio.', valor: 'Mantuvo una comunicacion efectiva durante todo el servicio', max: 25 },
        ],
      },
      {
        nombre: 'Reclamos',
        preguntas: [
          { texto: 'El cliente no manifestó actitudes irrespetuosas por parte del transportista, ayudante o caletero.', valor: 'El cliente manifestó alguna actitud irrespetuosa por parte del transportista, ayudante/caletero', max: 15 },
          { texto: 'El cliente no manifestó mala manipulación del PT por parte del transportista, ayudante o caletero.', valor: 'El cliente manifestó alguna mala manipulación del PT por parte del transportista, ayudante/caletero', max: 10 },
        ],
      },
    ],
  },
};

/** Escala que estaba (comentada) en el C#. Se aplica sobre el porcentaje (MP/ME tiene 60 puntos como máximo). */
export const ESCALA = [
  { desde: 80, calificacion: 'Excelente', decision: 'Aceptado Sin Condicion', categoria: 'EXCELENTE' },
  { desde: 60, calificacion: 'Bueno', decision: 'Aceptado con Condicion: Evaluar Criterios a mejorar para nueva evaluacion.', categoria: 'ACEPTADO' },
  { desde: 0, calificacion: 'Regular', decision: 'En Evaluacion: Se realizara visita tecnica para evaluar criterios minimos no cumplidos.', categoria: 'EN EVALUACION' },
];

export const puntajeMaximo = (e) => e.secciones.flatMap((s) => s.preguntas).reduce((n, p) => n + p.max, 0);

export function resultado(puntos, maximo = 100) {
  const pct = maximo ? (puntos / maximo) * 100 : 0;
  const { calificacion, decision, categoria } = ESCALA.find((e) => pct >= e.desde) ?? ESCALA.at(-1);
  return { calificacion, decision, categoria, porcentaje: Math.round(pct) };
}

/** Versión para el navegador (sin los textos internos de la tabla). */
export function configPublica(clave) {
  const e = EVALUACIONES[clave];
  if (!e) return null;
  return {
    clave,
    titulo: e.titulo,
    formato: e.formato,
    campos: e.campos,
    numeroAutomatico: Boolean(e.numeroAutomatico),
    secciones: e.secciones.map((s, i) => ({
      id: i,
      nombre: s.nombre,
      preguntas: s.preguntas.map((p, j) => ({ id: `${i}.${j}`, texto: p.texto, max: p.max })),
    })),
    puntajeMaximo: puntajeMaximo(e),
    escala: ESCALA,
  };
}
