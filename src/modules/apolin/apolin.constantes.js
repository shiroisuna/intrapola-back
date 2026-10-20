/*
 * Apolin — asistente virtual de Sistemas. Réplica en Node de chatbot.py / chatbot+ollama.py (Flask).
 * Mismas opciones, mismas tablas (CAA y Asistencia-Amapola) y mismo orden de pasos.
 */
export const CATEGORIAS = {
  soporte: 'Solicitud de Soporte de Sistemas',
  insumos: 'Solicitud de Insumos',
  usuario: 'Solicitud de Usuario',
  prestamo: 'Préstamo de Equipos',
  conversar: 'Preguntar algo general', // solo si hay IA configurada (nube u Ollama)
};

// Si CAA.tipo_soporte no responde se usa esta lista (la del chatbot.py)
export const OPCIONES_SOPORTE = ['Software', 'Hardware', 'Red', 'SAP', 'Telefonía', 'Fotocopiadora', 'Impresora', 'UPS'];
export const OPCIONES_INSUMOS = ['Toner', 'Mouse', 'Teclado', 'Baterías de UPS', 'Tinta HP', 'Tinta Epson'];
export const EQUIPOS_PRESTAMO = ['Laptop Presentaciones', 'Audifonos', 'Video Beam'];

/** DEFAULTDEPTID del reloj de asistencia → departamento (igual que en chatbot.py). */
export const DEPARTAMENTOS = {
  2: 'Sistemas', 3: 'Administracion', 4: 'Produccion', 5: 'Seguridad Industrial', 6: 'Mantenimiento',
  7: 'Gerencia General', 8: 'Compras', 9: 'RRHH', 10: 'Almacen', 12: 'Calidad', 13: 'Ventas', 16: 'Procesos',
};

export const PALABRAS_SALUDO = ['hola', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'buenas', 'hey', 'saludos', 'apolin', 'que tal', 'qué tal'];

/** Caras de la mascota (frontend/public/apolin/<cara>.png). */
export const CARAS = { normal: 'sonriente', pensando: 'pensativo', feliz: 'divertido', confundido: 'confundido', listo: 'aprobado' };

export const MINUTOS_CONVERSACION = 30;
export const DIAS_MAX_PRESTAMO = 60; // no se agenda un préstamo a más de 2 meses

/** Instrucciones para las preguntas generales. */
export function contextoGeneral({ empresa, usuario }) {
  const fecha = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `Eres Apolin, el asistente virtual de ${empresa.nombre} (Venezuela), creado por el departamento de Sistemas. Tu imagen es una galleta sonriente con el uniforme de la empresa.
Hoy es ${fecha}. Conversas con ${usuario.nombre}, del departamento ${usuario.departamento}.

Cómo respondes:
- Siempre en español, claro, amable y directo. Máximo unas 250 palabras, salvo que pidan más detalle.
- Usa pasos numerados ("1. ") o listas ("- ") cuando ayuden, y **negritas** para lo importante. No uses tablas ni HTML.
- Ayudas con temas generales: Excel, Word, correo, redacción de textos, cálculos, explicaciones y dudas de cultura general.

Límites:
- De la empresa solo sabes esto: ${empresa.nombre}, RIF ${empresa.rif}, teléfono ${empresa.telefono || 'no indicado'}, ${empresa.direccion || ''}. No inventes nombres, extensiones, políticas, sueldos ni números de ticket.
- Para trámites (soporte técnico, insumos, préstamo de equipos, usuario nuevo) di que escriba "menú" y elija la opción; tú no puedes crearlos desde la conversación.
- Nunca pidas ni repitas contraseñas, claves ni datos personales. Si te piden algo inapropiado o peligroso, rehúsate con amabilidad.
- Para datos que cambian (clima, precios, tasas del dólar, noticias, resultados): si tienes la herramienta de búsqueda, úsala y di de dónde sale el dato y de qué fecha es; si no la tienes, dilo en una frase y recomienda dónde consultarlo (por ejemplo, la página del BCV para la tasa oficial). No inventes cifras.
- Si no sabes algo, dilo con honestidad.`;
}
