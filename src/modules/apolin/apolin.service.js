import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { enviarCorreo } from '../../utils/correo.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as soporte from '../soporte/soporte.repository.js';
import * as repo from './apolin.repository.js';
import { analizarIntencion, cupoPersona, iaConfigurada, preguntaGeneral, puedeUsarIa } from './apolin.ia.js';
import { leerDatos } from '../../utils/datosJson.js';
import { EMPRESA } from '../contenido/contenido.constantes.js';
import {
  CARAS, CATEGORIAS, contextoGeneral, DIAS_MAX_PRESTAMO, EQUIPOS_PRESTAMO, MINUTOS_CONVERSACION, OPCIONES_INSUMOS, PALABRAS_SALUDO,
} from './apolin.constantes.js';

/*
 * Conversación de Apolin: la misma secuencia de pasos de /preguntar en chatbot.py, pero el estado
 * (quién es el trabajador, qué está pidiendo) se guarda en el servidor y no lo manda el navegador.
 *
 * Respuesta al navegador:
 *   { conversacion, respuestas: [{ texto, enlace? }], opciones: [], entrada: 'texto'|'numero'|'fecha'|null,
 *     sugerencia, cara, usuario }
 * En los textos, **así** se muestra en negrita (el navegador no interpreta HTML).
 */

/* ------------------------------ conversaciones ------------------------------ */
const conversaciones = new Map();
const VIDA_MS = MINUTOS_CONVERSACION * 60_000;
setInterval(() => {
  const ahora = Date.now();
  for (const [id, c] of conversaciones) if (c.vence < ahora) conversaciones.delete(id);
}, 5 * 60_000).unref();

function conversacion(id) {
  let c = id && conversaciones.get(id);
  if (!c) {
    c = { id: crypto.randomBytes(16).toString('hex'), paso: 'ficha', usuario: null, datos: {}, historialIa: [], pendientes: [] };
    conversaciones.set(c.id, c);
  }
  c.vence = Date.now() + VIDA_MS;
  return c;
}

/* --------------------------------- utilidades --------------------------------- */
const sinAcentos = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const esSaludo = (t) => {
  const s = sinAcentos(t);
  return ['h', 'hol', 'holi', 'ola'].includes(s) || PALABRAS_SALUDO.some((p) => s.includes(sinAcentos(p)));
};
const titulo = (t) => String(t ?? '').toLowerCase().replace(/(^|\s|-)\p{L}/gu, (m) => m.toUpperCase());
const primerNombre = (u) => titulo(u.nombre.split(/\s+/)[0]);
const saludoPorHora = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? '¡Buenos días!' : h < 18 && h >= 12 ? '¡Buenas tardes!' : '¡Buenas noches!';
};
const urlEncuesta = (id) => (process.env.APOLIN_URL_ENCUESTA || 'http://192.168.10.112/Sat/sistemas/encuesta_sastifacion_sistemas.aspx?key={id}')
  .replace('{id}', encodeURIComponent(id));
const fechaTexto = (d) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
/** Encuentra la opción aunque el usuario la escriba sin acentos o en minúsculas. */
const elegir = (texto, opciones) => {
  const t = sinAcentos(texto);
  return opciones.find((o) => sinAcentos(o) === t) ?? opciones.find((o) => t.length >= 3 && sinAcentos(o).startsWith(t)) ?? null;
};

/** DD/MM/AAAA o AAAA-MM-DD (lo que manda el selector de fecha) → Date UTC, o null. */
function leerFecha(texto) {
  const t = String(texto).trim();
  let d, m, a;
  let x = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (x) [, d, m, a] = x;
  else if ((x = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [, a, m, d] = x;
  else return null;
  const f = new Date(Date.UTC(+a, +m - 1, +d));
  return f.getUTCFullYear() === +a && f.getUTCMonth() === +m - 1 && f.getUTCDate() === +d ? f : null;
}
const hoyUtc = () => { const h = new Date(); return new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())); };

/* ------------------------------ armado de respuestas ------------------------------ */
function responder(c, partes, { opciones = [], entrada = 'texto', sugerencia, cara = CARAS.normal } = {}) {
  const respuestas = (Array.isArray(partes) ? partes : [partes]).filter(Boolean).map((p) => (typeof p === 'string' ? { texto: p } : p));
  return {
    conversacion: c.id,
    respuestas,
    opciones,
    entrada,
    sugerencia: sugerencia ?? (entrada === 'numero' ? 'Escribe un número' : entrada === 'fecha' ? 'DD/MM/AAAA' : 'Escribe aquí…'),
    cara,
    usuario: c.usuario ? { nombre: c.usuario.nombre, departamento: c.usuario.departamento } : null,
    ia: iaConfigurada(),
  };
}

function menu(c, partes = [], cara = CARAS.normal) {
  c.paso = 'menu';
  c.datos = {};
  const opciones = [CATEGORIAS.soporte, CATEGORIAS.insumos, CATEGORIAS.usuario, CATEGORIAS.prestamo];
  if (iaConfigurada()) opciones.push(CATEGORIAS.conversar);
  return responder(c, [...partes, '¿Qué tipo de solicitud deseas realizar?'], { opciones, entrada: iaConfigurada() ? 'texto' : null, cara, sugerencia: 'Elige una opción o escríbeme' });
}

function fin(c, partes, cara = CARAS.listo) {
  c.paso = 'fin';
  c.datos = {};
  return responder(c, [...partes, '¿Necesitas algo más?'], { opciones: ['Otra solicitud', 'Terminar'], entrada: null, cara });
}

/* ------------------------------------ pasos ------------------------------------ */

/** Identificación por ficha: reloj de asistencia (como el chatbot) + SPI para el nombre que usa la intranet. */
async function identificar(ficha) {
  const reloj = await repo.buscarEnReloj(ficha).catch((err) => { console.warn('[apolin] reloj:', err.message); return null; });
  let emp = await empleados.findByFicha(ficha).catch(() => null);
  if (!emp && reloj?.cedula) emp = await empleados.findByCedula(reloj.cedula).catch(() => null);
  if (!emp && !reloj) return null;
  const nombre = emp?.nombreCompleto || reloj.nombreCompleto;
  return {
    ficha: String(ficha),
    cedula: emp?.cedula ?? reloj?.cedula ?? null,
    nombre: titulo(nombre),
    // Así guarda la intranet al trabajador en los tickets ("NOMBRE-APELLIDO")
    nombreLegacy: emp ? empleados.nombreLegacy(emp) : nombre.toUpperCase().split(/\s+/).slice(0, 2).join('-'),
    nombreReloj: reloj?.nombreCompleto ?? null,
    departamento: emp?.departamento || reloj?.departamento || 'General',
    cumpleHoy: Boolean(reloj?.cumpleHoy),
  };
}

async function pasoFicha(c, texto) {
  if (!texto || esSaludo(texto)) {
    return responder(c, `${saludoPorHora()} Soy Apolin. Por favor, ingresa tu **número de ficha**:`, { entrada: 'numero', sugerencia: 'Número de ficha' });
  }
  const ficha = texto.replace(/\D/g, '');
  if (!ficha || ficha.length > 10) {
    return responder(c, 'Necesito tu **número de ficha** (solo números) para ayudarte.', { entrada: 'numero', sugerencia: 'Número de ficha', cara: CARAS.confundido });
  }
  const u = await identificar(ficha);
  if (!u) return responder(c, `No encontré la ficha **${ficha}**. Revísala e intenta de nuevo:`, { entrada: 'numero', sugerencia: 'Número de ficha', cara: CARAS.confundido });
  c.usuario = u;

  // Encuesta de satisfacción pendiente: bloquea el chat hasta completarla (como chatbot.py)
  const pendientes = await repo.ticketsSinEncuesta([u.nombreLegacy, u.nombreReloj]).catch((err) => { console.warn('[apolin] encuestas:', err.message); return []; });
  if (pendientes.length) return pedirEncuesta(c, pendientes);
  return bienvenida(c);
}

function pedirEncuesta(c, pendientes) {
  c.paso = 'encuesta';
  c.pendientes = pendientes;
  const t = pendientes[0];
  return responder(c, [
    `**${c.usuario.nombre}** de **${c.usuario.departamento}**, tu caso de soporte ya fue resuelto:`,
    `Ticket **#${t.id}** — ${t.tipo}${t.fecha ? ` (${t.fecha})` : ''}`,
    {
      texto: `Por favor completa la **encuesta de satisfacción** para seguir usando el chat.${pendientes.length > 1 ? ` Tienes ${pendientes.length} encuestas pendientes.` : ''}`,
      enlace: { texto: 'Abrir la encuesta', url: urlEncuesta(t.id) },
    },
  ], { opciones: ['Ya completé la encuesta'], entrada: null, cara: CARAS.confundido });
}

async function pasoEncuesta(c) {
  const pendientes = await repo.ticketsSinEncuesta([c.usuario.nombreLegacy, c.usuario.nombreReloj]).catch(() => c.pendientes);
  if (pendientes.length) {
    const sigue = pendientes[0].id === c.pendientes[0]?.id;
    const r = pedirEncuesta(c, pendientes);
    if (sigue) r.respuestas.unshift({ texto: 'Todavía no veo la encuesta registrada. Complétala y pulsa el botón de nuevo.' });
    return r;
  }
  return bienvenida(c, ['¡Gracias por responder la encuesta!']);
}

async function bienvenida(c, previas = []) {
  const u = c.usuario;
  const partes = [...previas, `${saludoPorHora()} Hola **${primerNombre(u)}** de **${u.departamento}**.`];
  let cara = CARAS.normal;
  if (u.cumpleHoy) { partes.push('🎂 ¡Feliz cumpleaños de parte de todo el equipo de Industrias Amapola!'); cara = CARAS.feliz; }
  const vencidos = await repo.prestamosVencidos(u.ficha).catch(() => []);
  if (vencidos.length) {
    partes.push(`⚠️ ¡Oh, vaya! Tienes ${vencidos.length === 1 ? 'un préstamo vencido' : `${vencidos.length} préstamos vencidos`}: **${vencidos.map((v) => v.equipo).join(', ')}**. Por favor recuerda devolverlo${vencidos.length === 1 ? '' : 's'}. Gracias.`);
  }
  return menu(c, partes, cara);
}

async function pasoMenu(c, texto, ip) {
  const op = elegir(texto, Object.values(CATEGORIAS));
  if (op === CATEGORIAS.soporte) return pedirTipoSoporte(c);
  if (op === CATEGORIAS.insumos) return pedirInsumo(c);
  if (op === CATEGORIAS.prestamo) return pedirEquipo(c);
  if (op === CATEGORIAS.usuario) return usuarioNuevo(c);
  if (op === CATEGORIAS.conversar && iaConfigurada()) {
    c.paso = 'conversar';
    const { quedan } = cupoPersona(c.usuario.ficha);
    return responder(c, [
      `¡Claro, ${primerNombre(c.usuario)}! Pregúntame lo que quieras: fórmulas de Excel, cómo redactar un correo, una explicación, una idea…`,
      `ℹ️ Estas preguntas las respondo con un servicio de inteligencia artificial externo: **no escribas claves ni datos confidenciales**. Hoy te quedan **${quedan}** preguntas. Para volver a los trámites escribe **menú**.`,
    ], { opciones: ['Volver al menú'], sugerencia: 'Escribe tu pregunta' });
  }
  // Texto libre en el menú: si hay IA se interpreta, si no se repite el menú
  if (iaConfigurada()) { c.paso = 'conversar'; return pasoConversar(c, texto, ip); }
  return menu(c, ['No entendí. Elige una de las opciones:'], CARAS.confundido);
}

async function pedirTipoSoporte(c, tipo) {
  c.datos = { categoria: 'soporte' };
  if (tipo) { c.datos.tipo = tipo; c.paso = 'soporte_descripcion'; return responder(c, `Describe brevemente tu requerimiento para **${tipo}**:`, { sugerencia: 'Ej. la impresora no imprime' }); }
  c.paso = 'soporte_tipo';
  c.datos.opciones = await repo.tiposSoporte();
  return responder(c, '¿Con qué necesitas ayuda?', { opciones: c.datos.opciones, entrada: null });
}

async function crearTicket(c, descripcion) {
  const u = c.usuario;
  const tipo = c.datos.tipo;
  const id = await soporte.insertar({ departamento: u.departamento, usuario: u.nombreLegacy, tipo, descripcion });
  const correo = await enviarCorreo({
    para: env.correo.sistemas,
    asunto: `Ticket #${id ?? '—'}: ${tipo} - ${u.nombre.toUpperCase()} (Apolin)`,
    texto: [
      'Apolin - Nuevo ticket de soporte', '',
      `Ticket: ${id ?? '—'}`, `Empleado: ${u.nombre}`, `Ficha: ${u.ficha}`, `Cédula: ${u.cedula ?? '—'}`,
      `Departamento: ${u.departamento}`, `Tipo: ${tipo}`, `Descripción: ${descripcion}`, `Fecha: ${new Date().toLocaleString('es-VE')}`,
    ].join('\n'),
  });
  return fin(c, [
    `✅ **Ticket #${id ?? '—'}** creado con éxito.${correo ? ' Ya le avisé a Sistemas por correo.' : ''}`,
    { texto: 'Puedes ver cómo avanza en Mis solicitudes.', enlace: { texto: 'Ver mis solicitudes', url: '/solicitudes/mis-solicitudes', interno: true } },
  ]);
}

function pedirInsumo(c, insumo) {
  c.datos = { categoria: 'insumos' };
  if (insumo) { c.datos.tipo = insumo; c.paso = 'insumo_cantidad'; return responder(c, `¿Cuántas unidades de **${insumo}** necesitas?`, { entrada: 'numero' }); }
  c.paso = 'insumo_tipo';
  return responder(c, '¿Qué insumo necesitas?', { opciones: OPCIONES_INSUMOS, entrada: null });
}

/** El chatbot no guardaba los insumos en ninguna tabla: solo avisaba por correo a Sistemas. Se mantiene igual. */
async function registrarInsumo(c, detalle) {
  const u = c.usuario;
  const { tipo, cantidad } = c.datos;
  const correo = await enviarCorreo({
    para: env.correo.sistemas,
    asunto: `Insumos: ${cantidad} ${tipo} - ${u.nombre.toUpperCase()} (Apolin)`,
    texto: [
      'Apolin - Solicitud de insumos', '',
      `Empleado: ${u.nombre}`, `Ficha: ${u.ficha}`, `Departamento: ${u.departamento}`,
      `Insumo: ${tipo}`, `Cantidad: ${cantidad}`, `Detalle: ${detalle || 'Sin observaciones'}`, `Fecha: ${new Date().toLocaleString('es-VE')}`,
    ].join('\n'),
  });
  if (!correo) return fin(c, ['No pude enviar tu solicitud a Sistemas en este momento. Intenta más tarde o llama a la extensión de Sistemas.'], CARAS.confundido);
  return fin(c, [`✅ Solicitud de **${cantidad} ${tipo}** enviada a Sistemas.`]);
}

function pedirEquipo(c, equipo) {
  c.datos = { categoria: 'prestamo' };
  if (equipo) { c.datos.equipo = equipo; c.paso = 'prestamo_fecha'; return responder(c, `¿Para qué fecha necesitas **${equipo}**?`, { entrada: 'fecha' }); }
  c.paso = 'prestamo_equipo';
  return responder(c, '¿Qué equipo necesitas?', { opciones: EQUIPOS_PRESTAMO, entrada: null });
}

async function pasoFechaPrestamo(c, texto) {
  const fecha = leerFecha(texto);
  if (!fecha) return responder(c, 'Formato inválido. Usa **DD/MM/AAAA** (por ejemplo 25/12/2026).', { entrada: 'fecha', cara: CARAS.confundido });
  const hoy = hoyUtc();
  if (fecha < hoy) return responder(c, 'Esa fecha ya pasó. ¿Para qué día lo necesitas?', { entrada: 'fecha', cara: CARAS.confundido });
  if ((fecha - hoy) / 86_400_000 > DIAS_MAX_PRESTAMO) return responder(c, `Solo se puede apartar con un máximo de ${DIAS_MAX_PRESTAMO} días de anticipación.`, { entrada: 'fecha', cara: CARAS.confundido });
  const devolucion = new Date(fecha.getTime() + 86_400_000);
  c.datos.fechaPrestamo = fecha;
  c.datos.fechaDevolucion = devolucion;
  c.paso = 'prestamo_confirmar';
  const ocupado = await repo.equipoOcupado(c.datos.equipo, fecha).catch(() => false);
  return responder(c, [
    `📅 **${c.datos.equipo}** para el **${fechaTexto(fecha)}**. Debes devolverlo el día siguiente (**${fechaTexto(devolucion)}**).`,
    ocupado ? '⚠️ Ojo: ese equipo ya tiene otra reserva para ese día. Sistemas te confirmará si está disponible.' : null,
    '¿Confirmas el préstamo?',
  ], { opciones: ['Confirmar', 'Cancelar'], entrada: null });
}

async function confirmarPrestamo(c) {
  const u = c.usuario;
  const { equipo, fechaPrestamo, fechaDevolucion } = c.datos;
  const id = await repo.crearPrestamo({ ficha: u.ficha, nombre: u.nombre.toUpperCase(), departamento: u.departamento, equipo, fechaPrestamo, fechaDevolucion });
  const correo = await enviarCorreo({
    para: env.correo.sistemas,
    asunto: `PRÉSTAMO #${id ?? '—'} - ${equipo} - ${u.nombre.toUpperCase()}`,
    texto: [
      'NUEVA SOLICITUD DE PRÉSTAMO DE EQUIPO', '========================================', '',
      `ID Préstamo: ${id ?? '—'}`, `Empleado: ${u.nombre}`, `Ficha: ${u.ficha}`, `Departamento: ${u.departamento}`, `Equipo: ${equipo}`,
      `Fecha de Préstamo: ${fechaTexto(fechaPrestamo)}`, `Fecha Límite de Devolución: ${fechaTexto(fechaDevolucion)}`, '',
      'Este préstamo debe ser entregado al empleado en la fecha solicitada.',
      'Al vencer la fecha límite, el sistema le recordará al usuario.',
    ].join('\n'),
  });
  return fin(c, [
    `✅ **Préstamo #${id ?? '—'}** registrado.`,
    `📦 Equipo: **${equipo}**\n📅 Préstamo: **${fechaTexto(fechaPrestamo)}**\n⏰ Devolver antes de: **${fechaTexto(fechaDevolucion)}**`,
    correo ? 'Ya le avisé a Sistemas por correo.' : null,
  ]);
}

function usuarioNuevo(c) {
  return fin(c, [{
    texto: 'Las solicitudes de usuario nuevo se hacen con la planilla oficial (la firma el jefe del área).',
    enlace: { texto: 'Abrir la planilla de usuario nuevo', url: '/solicitudes/usuarios', interno: true },
  }], CARAS.normal);
}

/** Modo conversación (chatbot+ollama.py): si el mensaje pide algo concreto se va al flujo; si no, responde la IA. */
async function pasoConversar(c, texto, ip) {
  const [intencion, item] = analizarIntencion(texto);
  if (intencion === 'soporte') {
    // Solo se usa el tipo detectado si existe en la tabla de tipos de soporte
    const tipo = item ? (await repo.tiposSoporte()).find((x) => sinAcentos(x) === sinAcentos(item)) : null;
    return pedirTipoSoporte(c, tipo ?? null);
  }
  if (intencion === 'insumos') return pedirInsumo(c, item);
  if (intencion === 'prestamo') return pedirEquipo(c, item);
  if (intencion === 'usuario') return usuarioNuevo(c);

  if (!puedeUsarIa(ip)) return responder(c, '⏳ Espera un momento antes de escribir de nuevo.', { opciones: ['Volver al menú'] });
  if (texto.length < 2) return responder(c, '¿Qué quieres preguntarme?', { opciones: ['Volver al menú'], sugerencia: 'Escribe tu pregunta' });

  const empresa = leerDatos('empresa', EMPRESA);
  const r = await preguntaGeneral(c.usuario.ficha, contextoGeneral({ empresa, usuario: c.usuario }), c.historialIa, texto);
  const opciones = ['Volver al menú'];

  if (r.motivo === 'agotado') {
    return menu(c, ['😅 Me quedé sin memoria amplia por hoy para temas generales. Mañana vuelvo a tenerla.', 'Mientras tanto sí puedo ayudarte con los trámites de la intranet:'], CARAS.confundido);
  }
  if (r.motivo === 'cupo_persona') {
    return menu(c, [`Ya usaste tus ${r.cupo.max} preguntas generales de hoy. Mañana puedes seguir preguntándome.`, 'Con los trámites de la intranet te ayudo cuando quieras:'], CARAS.confundido);
  }
  if (r.motivo) {
    return responder(c, 'Ahora no logro conectarme con mi memoria amplia. Intenta de nuevo en un rato, o escribe **menú** para hacer una solicitud.', { opciones, cara: CARAS.confundido, sugerencia: 'Escribe tu pregunta' });
  }
  c.historialIa = [...c.historialIa, { role: 'user', content: texto }, { role: 'assistant', content: r.texto }].slice(-6);
  const partes = [r.texto];
  if (r.cupo.quedan <= 3) partes.push(r.cupo.quedan ? `_Te quedan ${r.cupo.quedan} preguntas generales hoy._` : '_Esa fue tu última pregunta general de hoy._');
  return responder(c, partes, { opciones, sugerencia: 'Escribe otra pregunta', cara: CARAS.normal });
}

/* ------------------------------------ entrada ------------------------------------ */
export async function mensaje({ conversacion: id, texto = '' }, ip) {
  const vencida = Boolean(id) && !conversaciones.has(id);
  const c = conversacion(id);
  const t = String(texto).trim().slice(0, 1000);
  if (vencida) {
    return responder(c, 'Pasó un buen rato sin actividad, así que empecemos de nuevo. Ingresa tu **número de ficha**:', { entrada: 'numero', sugerencia: 'Número de ficha', cara: CARAS.pensando });
  }

  // Atajos que funcionan en cualquier paso una vez identificado
  if (c.usuario && c.paso !== 'encuesta') {
    const s = sinAcentos(t);
    if (['menu', 'volver al menu', 'otra solicitud', 'cancelar', 'volver'].includes(s)) {
      return menu(c, s === 'cancelar' && c.paso.startsWith('prestamo') ? ['Préstamo cancelado.'] : []);
    }
    // "gracias" en medio de una pregunta general no termina la conversación
    if (['terminar', 'salir', 'adios', 'chao'].includes(s) || (s === 'gracias' && c.paso !== 'conversar')) {
      conversaciones.delete(c.id);
      const nueva = conversacion();
      return responder(nueva, `¡Hasta luego, ${primerNombre(c.usuario)}! Cuando me necesites, aquí estaré.`, { entrada: 'numero', sugerencia: 'Número de ficha', cara: CARAS.feliz });
    }
  }

  try {
    switch (c.paso) {
      case 'ficha': return await pasoFicha(c, t);
      case 'encuesta': return await pasoEncuesta(c);
      case 'menu': return await pasoMenu(c, t, ip);
      case 'conversar': return await pasoConversar(c, t, ip);

      case 'soporte_tipo': {
        const tipo = elegir(t, c.datos.opciones ?? []);
        if (!tipo) return responder(c, 'Elige una de las opciones:', { opciones: c.datos.opciones, entrada: null, cara: CARAS.confundido });
        return pedirTipoSoporte(c, tipo);
      }
      case 'soporte_descripcion':
        if (t.length < 5) return responder(c, 'Describe un poco más el problema, así el técnico llega preparado:', { cara: CARAS.pensando });
        return await crearTicket(c, t);

      case 'insumo_tipo': {
        const insumo = elegir(t, OPCIONES_INSUMOS);
        if (!insumo) return responder(c, 'Elige uno de los insumos:', { opciones: OPCIONES_INSUMOS, entrada: null, cara: CARAS.confundido });
        return pedirInsumo(c, insumo);
      }
      case 'insumo_cantidad': {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 1 || n > 100) return responder(c, 'Indica una cantidad entre 1 y 100:', { entrada: 'numero', cara: CARAS.confundido });
        c.datos.cantidad = n;
        c.paso = 'insumo_detalle';
        return responder(c, 'Perfecto. Ahora describe el motivo o detalle del pedido (por ejemplo, el modelo de la impresora):', { opciones: ['Sin observaciones'] });
      }
      case 'insumo_detalle':
        return await registrarInsumo(c, ['sin observaciones', 'ninguna', 'ninguno', 'nada', 'no'].includes(sinAcentos(t)) ? '' : t);

      case 'prestamo_equipo': {
        const equipo = elegir(t, EQUIPOS_PRESTAMO);
        if (!equipo) return responder(c, 'Elige uno de los equipos:', { opciones: EQUIPOS_PRESTAMO, entrada: null, cara: CARAS.confundido });
        return pedirEquipo(c, equipo);
      }
      case 'prestamo_fecha': return await pasoFechaPrestamo(c, t);
      case 'prestamo_confirmar':
        if (sinAcentos(t) === 'confirmar' || sinAcentos(t).startsWith('si')) return await confirmarPrestamo(c);
        return menu(c, ['Préstamo cancelado.']);

      case 'fin':
      default:
        return menu(c);
    }
  } catch (err) {
    console.error('[apolin]', err);
    return responder(c, 'Tuve un problema para guardar tu solicitud. Intenta de nuevo en unos minutos o avisa a Sistemas.', {
      opciones: c.usuario ? ['Volver al menú'] : [], entrada: c.usuario ? 'texto' : 'numero', cara: CARAS.confundido,
    });
  }
}

/** Saludo inicial (al abrir el chat) con los recordatorios del día. */
export async function inicio(id) {
  const c = conversacion(id);
  if (c.usuario && c.paso !== 'ficha') return { ...menu(c), reanudada: true };
  const recordatorios = await repo.recordatoriosDeHoy().catch(() => []);
  return {
    ...responder(c, `${saludoPorHora()} Soy **Apolin**, el asistente de Sistemas. Por favor, ingresa tu **número de ficha**.`, { entrada: 'numero', sugerencia: 'Número de ficha' }),
    recordatorios: recordatorios.map((r) => ({
      id: r.id, titulo: r.titulo, mensaje: r.mensaje, tipo: r.tipo,
      imagenUrl: r.tieneImagen ? `/api/apolin/recordatorios/${r.id}/imagen` : null,
    })),
  };
}

/** Tarea periódica: marca los préstamos vencidos como notificados (verificar_y_notificar_prestamos_vencidos). */
export async function revisarPrestamosVencidos() {
  try {
    const vencidos = await repo.marcarVencidosNotificados();
    for (const v of vencidos) console.log(`[apolin] préstamo #${v.id} vencido: ${v.nombre} debe devolver ${v.equipo} (desde ${v.devolucion})`);
  } catch (err) {
    console.warn('[apolin] préstamos vencidos:', err.message);
  }
}
