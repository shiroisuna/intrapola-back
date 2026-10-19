/*
 * Contenido institucional que no cambia seguido y no tiene tabla en amapolanet ni en CAA.
 * Editar aquí y reiniciar la API. Si más adelante se quiere administrar desde la intranet,
 * se pasa a una tabla y solo cambia contenido.repository.js.
 */

export const EMPRESA = {
  nombre: 'Industrias Amapola C.A.',
  rif: 'J-00180812-4',
  mision: 'Somos una empresa que desarrolla y elabora alimentos reconocidos por su calidad y accesibilidad, sustentados en innovación, esfuerzo y profesionalismo, que contribuye al bienestar de sus trabajadores y la familia venezolana.',
  vision: 'Ser líderes del mercado en los productos que elaboramos, con un incremento sostenido del volumen de ventas, conservando la cultura familiar de nuestra empresa.',
  valores: ['Respeto', 'Trabajo en equipo', 'Perseverancia', 'Calidad', 'Honestidad', 'Confianza'],
  direccion: 'Carretera Charallave - Cúa, Zona Industrial Río Tuy, Avenida G, Parcelas 77 y 78, Charallave, Edo. Miranda',
  telefono: '0239-5001600',
  fax: '0239-5001614',
  correo: 'contacto@industriasamapola.com',
  mapaUrl: 'https://www.google.com/maps?q=Zona+Industrial+Rio+Tuy+Charallave&output=embed',
};

/** Enlaces a otros sistemas (menú lateral). Ajustar las URL reales. */
export const ENLACES = [
  { id: 1, titulo: 'SAT', descripcion: 'Sistema de atención al trabajador', url: 'http://192.168.10.112/SAT' },
  { id: 2, titulo: 'Academia Mary', descripcion: 'Formación interna', url: '#' },
  { id: 3, titulo: 'SGD', descripcion: 'Sistema de gestión de documentos', url: 'http://192.168.10.101' },
];

/**
 * Productos del inicio ("Lo que hacemos"). imagenUrl acepta rutas del IIS ("~/imagenes/x.jpg")
 * o URL completas. Vacío = el bloque no se muestra.
 */
export const PRODUCTOS = [
  // { id: 1, marca: 'Charmy', nombre: 'Charmy tubular', presentacion: 'Empaque familiar tubular, 192 g', imagenUrl: '~/imagenes/charmy.png' },
];
