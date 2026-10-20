/*
 * Apolin — asistente virtual de Sistemas. Réplica en Node de chatbot.py / chatbot+ollama.py (Flask).
 * Mismas opciones, mismas tablas (CAA y Asistencia-Amapola) y mismo orden de pasos.
 */
export const CATEGORIAS = {
  soporte: 'Solicitud de Soporte de Sistemas',
  insumos: 'Solicitud de Insumos',
  usuario: 'Solicitud de Usuario',
  prestamo: 'Préstamo de Equipos',
  conversar: 'Conversar con Apolin', // solo si la IA (Ollama) está configurada
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

/** Instrucciones para la IA: las del chatbot+ollama.py. */
export const CONTEXTO_IA = `Eres APOLIN, asistente virtual del departamento de Sistemas de Industrias Amapola.

REGLAS ESTRICTAS:
1. Responde EN UNA SOLA FRASE CORTA (máximo 25 palabras).
2. Siempre en español.
3. Sé amable pero directo.
4. Nunca des explicaciones largas.
5. Si no sabes algo, di "Consulta a Sistemas".
6. No inventes números de ticket, fechas ni datos de la empresa.`;
