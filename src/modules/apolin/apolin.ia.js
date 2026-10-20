/*
 * IA de Apolin para preguntas generales. Dos proveedores, en el orden de APOLIN_IA_ORDEN (por defecto "nube,local"):
 *
 *   nube  → cualquier servicio compatible con la API de OpenAI (Groq, Gemini, OpenRouter, Mistral...):
 *           APOLIN_NUBE_URL   ej. https://api.groq.com/openai/v1
 *           APOLIN_NUBE_CLAVE la clave del servicio
 *           APOLIN_NUBE_MODELO ej. openai/gpt-oss-20b
 *   local → Ollama en el servidor: APOLIN_OLLAMA_URL (ej. http://127.0.0.1:11434) y APOLIN_OLLAMA_MODELO
 *
 * Si la nube responde que se acabó la cuota (429/402/403), queda "agotada" hasta que el servicio diga
 * (encabezado retry-after) o hasta mañana, y se usa el siguiente proveedor. Si no queda ninguno, Apolin avisa.
 */

import { guardarDatos, leerDatos } from '../../utils/datosJson.js';

/*
 * Ajustes: lo que se guarda desde Admin → Apolin (datos/apolin-ia.json) manda sobre el .env.
 * Lo que no se haya guardado en el panel se toma de las variables APOLIN_* del .env.
 */
function desdeEnv() {
  const e = process.env;
  return {
    orden: e.APOLIN_IA_ORDEN || 'nube,local',
    preguntasDia: Number(e.APOLIN_PREGUNTAS_DIA || 25),
    maxTokens: Number(e.APOLIN_MAX_TOKENS || 900),
    nube: { nombre: e.APOLIN_NUBE_NOMBRE || 'nube', url: e.APOLIN_NUBE_URL || '', clave: e.APOLIN_NUBE_CLAVE || '', modelo: e.APOLIN_NUBE_MODELO || '', busqueda: e.APOLIN_NUBE_BUSQUEDA === 'true' },
    local: { url: e.APOLIN_OLLAMA_URL || '', modelo: e.APOLIN_OLLAMA_MODELO || 'llama3.2' },
  };
}
export function ajustes() {
  const base = desdeEnv();
  const g = leerDatos('apolin-ia', {});
  return {
    ...base,
    ...Object.fromEntries(Object.entries(g).filter(([k, v]) => !['nube', 'local'].includes(k) && v !== undefined && v !== null)),
    nube: { ...base.nube, ...(g.nube ?? {}) },
    local: { ...base.local, ...(g.local ?? {}) },
  };
}
/** Guarda desde el panel. Si la clave viene vacía se conserva la anterior. */
export function guardarAjustes(nuevo, usuario) {
  const actual = leerDatos('apolin-ia', {});
  const nube = { ...(actual.nube ?? {}), ...nuevo.nube };
  if (!nuevo.nube?.clave) nube.clave = actual.nube?.clave ?? undefined;
  if (nuevo.nube?.quitarClave) nube.clave = '';
  delete nube.quitarClave;
  guardarDatos('apolin-ia', { ...actual, ...nuevo, nube, local: { ...(actual.local ?? {}), ...nuevo.local }, actualizadoEn: new Date().toISOString(), actualizadoPor: usuario });
  // Con ajustes nuevos se vuelve a intentar todo
  busquedaRechazada = false;
  for (const k of Object.keys(agotado)) delete agotado[k];
  for (const k of Object.keys(ultimoError)) delete ultimoError[k];
  return ajustesPublicos();
}
/** Lo que ve el panel: nunca la clave completa. */
export function ajustesPublicos() {
  const a = ajustes();
  const { clave, ...nube } = a.nube;
  const g = leerDatos('apolin-ia', {});
  return {
    ...a,
    nube: { ...nube, claveConfigurada: Boolean(clave), claveFinal: clave ? clave.slice(-4) : null },
    actualizadoEn: g.actualizadoEn ?? null,
    actualizadoPor: g.actualizadoPor ?? null,
  };
}

const sinBarra = (u) => String(u || '').replace(/\/+$/, '');
const cfg = {
  nube: () => { const n = ajustes().nube; return { ...n, url: sinBarra(n.url), nombre: n.nombre || 'nube' }; },
  local: () => { const l = ajustes().local; return { ...l, url: sinBarra(l.url), nombre: 'Ollama (servidor)' }; },
};
const configurado = {
  nube: () => { const c = cfg.nube(); return Boolean(c.url && c.clave && c.modelo); },
  local: () => Boolean(cfg.local().url && cfg.local().modelo),
};
const orden = () => String(ajustes().orden).split(',').map((x) => x.trim()).filter((p) => configurado[p]?.());
export const iaConfigurada = () => orden().length > 0;
const ultimoError = {}; // proveedor → { mensaje, fecha }

/* ------------------------------- estado y uso del día ------------------------------- */
const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD, hora del servidor
const uso = { fecha: hoy(), proveedores: {}, personas: new Map() };
const agotado = {}; // proveedor → fecha (ms) hasta la que no se usa

function reiniciarSiCambioElDia() {
  if (uso.fecha !== hoy()) { uso.fecha = hoy(); uso.proveedores = {}; uso.personas.clear(); }
}
function contar(proveedor, tokens) {
  const u = (uso.proveedores[proveedor] ??= { preguntas: 0, tokens: 0, errores: 0 });
  u.preguntas += 1;
  u.tokens += tokens || 0;
}
const mananaTemprano = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 5, 0, 0); return d.getTime(); };

/** Preguntas generales por persona y por día (APOLIN_PREGUNTAS_DIA, por defecto 25). */
export function cupoPersona(clave) {
  reiniciarSiCambioElDia();
  const max = Number(ajustes().preguntasDia) || 25;
  const usadas = uso.personas.get(clave) ?? 0;
  return { usadas, max, quedan: Math.max(0, max - usadas) };
}
const gastarCupo = (clave) => uso.personas.set(clave, (uso.personas.get(clave) ?? 0) + 1);

/** Quita el razonamiento interno que algunos modelos escriben entre <think> ... </think>. */
const limpiar = (t) => String(t ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();

/* ------------------------------------ llamadas ------------------------------------ */
class SinCuota extends Error {}

/*
 * Búsqueda en internet (APOLIN_NUBE_BUSQUEDA=true): herramienta "browser_search" de Groq, disponible en
 * openai/gpt-oss-20b y gpt-oss-120b. El modelo decide si busca (solo cuando la pregunta lo necesita).
 * Si el servicio no la acepta, se desactiva sola y se sigue sin búsqueda.
 */
let busquedaRechazada = false;
const usarBusqueda = () => Boolean(ajustes().nube.busqueda) && !busquedaRechazada;
/** Quita las marcas de cita que agrega la búsqueda (【1†L3-L5】) y deja el texto limpio. */
const sinCitas = (t) => t.replace(/【[^】]*】/g, '').replace(/[ \t]+\n/g, '\n').trim();

async function llamarNube(mensajes, { maxTokens, tiempo }) {
  const c = cfg.nube();
  const buscar = usarBusqueda();
  const cuerpoPeticion = { model: c.modelo, messages: mensajes, max_tokens: maxTokens, temperature: 0.6 };
  if (buscar) Object.assign(cuerpoPeticion, { tools: [{ type: 'browser_search' }], tool_choice: 'auto', reasoning_effort: 'low', max_tokens: Math.max(maxTokens, 2000) });
  const res = await fetch(`${c.url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.clave}` },
    signal: AbortSignal.timeout(tiempo),
    body: JSON.stringify(cuerpoPeticion),
  });
  if (buscar && res.status === 400) {
    const detalle = await res.text().catch(() => '');
    if (/tool|browser_search|reasoning/i.test(detalle)) {
      busquedaRechazada = true;
      console.warn(`[apolin] el modelo ${c.modelo} no acepta búsqueda en internet; sigo sin ella. ${detalle.slice(0, 160)}`);
      return llamarNube(mensajes, { maxTokens, tiempo });
    }
    throw new Error(`HTTP 400 ${detalle.slice(0, 160)}`);
  }
  if ([402, 403, 429].includes(res.status)) {
    const espera = Number(res.headers.get('retry-after'));
    const cuerpo = await res.text().catch(() => '');
    const hablaDeCuota = /day|daily|quota|credit|exhaust|limit|diari|cuota|insufficient/i.test(cuerpo);
    // Un 403 que no habla de cuota es un rechazo (clave, país o permisos): se informa, no se bloquea hasta mañana
    if (res.status === 403 && !hablaDeCuota) throw new Error(`HTTP 403 ${cuerpo.slice(0, 200)}`);
    // Un 429 por minuto se espera unos segundos; si habla de cuota diaria o créditos, hasta mañana
    const diario = res.status === 402 || /day|daily|quota|credit|exhaust|diari|cuota|insufficient/i.test(cuerpo) || espera > 300;
    agotado.nube = diario ? mananaTemprano() : Date.now() + Math.max(15, espera || 30) * 1000;
    throw new SinCuota(`${res.status} ${cuerpo.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const data = await res.json();
  return { texto: sinCitas(limpiar(data?.choices?.[0]?.message?.content)), tokens: data?.usage?.total_tokens, busco: Boolean(data?.choices?.[0]?.message?.executed_tools?.length) };
}

async function llamarLocal(mensajes, { maxTokens, tiempo }) {
  const c = cfg.local();
  const res = await fetch(`${c.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(tiempo),
    body: JSON.stringify({
      model: c.modelo, stream: false, keep_alive: -1, messages: mensajes,
      options: { num_predict: maxTokens, temperature: 0.6, num_ctx: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { texto: limpiar(data?.message?.content), tokens: (data?.prompt_eval_count ?? 0) + (data?.eval_count ?? 0) };
}

const LLAMAR = { nube: llamarNube, local: llamarLocal };

/**
 * Pregunta a la IA con el primer proveedor disponible.
 * Devuelve { texto, proveedor } o { motivo: 'agotado' | 'error' }.
 *   modo 'corto'   → respuestas de una frase (dentro de los trámites)
 *   modo 'general' → preguntas de cualquier tema
 */
export async function preguntarIa(sistema, historial, pregunta, { modo = 'general' } = {}) {
  reiniciarSiCambioElDia();
  const mensajes = [{ role: 'system', content: sistema }, ...historial.slice(-6), { role: 'user', content: pregunta }];
  const opciones = modo === 'corto'
    ? { maxTokens: 120, tiempo: 20_000 }
    : { maxTokens: Number(ajustes().maxTokens) || 900, tiempo: Number(process.env.APOLIN_IA_TIMEOUT_MS || 90_000) };

  let huboCuota = false;
  for (const p of orden()) {
    if (agotado[p] && agotado[p] > Date.now()) { huboCuota = true; continue; }
    try {
      const r = await LLAMAR[p](mensajes, opciones);
      if (!r.texto) throw new Error('respuesta vacía');
      contar(p, r.tokens);
      return { texto: r.texto.slice(0, 4000), proveedor: p };
    } catch (err) {
      (uso.proveedores[p] ??= { preguntas: 0, tokens: 0, errores: 0 }).errores += 1;
      ultimoError[p] = { mensaje: (err.name === 'TimeoutError' ? 'tiempo de espera agotado' : err.message).slice(0, 240), fecha: new Date().toISOString() };
      if (err instanceof SinCuota) { huboCuota = true; console.warn(`[apolin] ${cfg[p]().nombre} sin cuota: ${err.message}`); continue; }
      console.warn(`[apolin] ${cfg[p]().nombre} no respondió: ${err.name === 'TimeoutError' ? 'tiempo agotado' : err.message}`);
    }
  }
  return { motivo: huboCuota ? 'agotado' : 'error' };
}

/** Pregunta general de una persona: respeta su cupo diario. */
export async function preguntaGeneral(clavePersona, sistema, historial, pregunta) {
  const cupo = cupoPersona(clavePersona);
  if (cupo.quedan <= 0) return { motivo: 'cupo_persona', cupo };
  const r = await preguntarIa(sistema, historial, pregunta, { modo: 'general' });
  if (r.texto) gastarCupo(clavePersona);
  return { ...r, cupo: cupoPersona(clavePersona) };
}

/** Para el panel de administración. */
export async function estadoIa() {
  reiniciarSiCambioElDia();
  const proveedores = [];
  for (const p of ['nube', 'local']) {
    const c = cfg[p]();
    const item = { id: p, nombre: c.nombre, configurado: configurado[p](), modelo: c.modelo || null, uso: uso.proveedores[p] ?? { preguntas: 0, tokens: 0, errores: 0 } };
    if (p === 'nube') item.busqueda = c.busqueda ? (busquedaRechazada ? 'rechazada' : 'activa') : 'apagada';
    if (ultimoError[p]) item.ultimoError = ultimoError[p];
    if (agotado[p] && agotado[p] > Date.now()) item.agotadoHasta = new Date(agotado[p]).toISOString();
    if (item.configurado) {
      try {
        if (p === 'local') {
          const r = await fetch(`${c.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
          const modelos = ((await r.json()).models ?? []).map((m) => m.name);
          item.disponible = true;
          item.modeloInstalado = modelos.some((m) => m.startsWith(c.modelo));
        } else {
          const r = await fetch(`${c.url}/models`, { headers: { Authorization: `Bearer ${c.clave}` }, signal: AbortSignal.timeout(5000) });
          item.disponible = r.ok;
          if (!r.ok) item.error = `HTTP ${r.status}`;
        }
      } catch (err) {
        item.disponible = false;
        item.error = err.message;
      }
    }
    proveedores.push(item);
  }
  return { configurada: iaConfigurada(), orden: orden(), preguntasPorPersona: Number(ajustes().preguntasDia) || 25, personasHoy: uso.personas.size, proveedores };
}

/* ---- Frecuencia: máximo 15 mensajes a la IA por minuto por equipo (check_rate_limit_ia) ---- */
const usos = new Map();
export function puedeUsarIa(ip) {
  const ahora = Date.now();
  const lista = (usos.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  if (lista.length >= 15) { usos.set(ip, lista); return false; }
  lista.push(ahora);
  usos.set(ip, lista);
  return true;
}

/* ---- Intención del mensaje (analizar_intencion): solo pedidos claros van al trámite ---- */
const sinAcentos = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function analizarIntencion(texto) {
  const t = sinAcentos(texto);
  const tiene = (...p) => p.some((x) => t.includes(x));
  const pide = tiene('necesito', 'quiero', 'solicito', 'solicitar', 'me prestas', 'me puedes prestar', 'pedir', 'dame', 'requiero');

  if (tiene('prestamo', 'equipo prestado', 'me prestas', 'me puedes prestar') || (pide && tiene('audifono', 'laptop', 'video beam', 'videobeam'))) {
    if (tiene('audifono')) return ['prestamo', 'Audifonos'];
    if (tiene('laptop')) return ['prestamo', 'Laptop Presentaciones'];
    if (tiene('video', 'beam')) return ['prestamo', 'Video Beam'];
    return ['prestamo', null];
  }
  if (tiene('no funciona', 'no sirve', 'no prende', 'no enciende', 'no imprime', 'no tengo internet', 'se dano', 'esta danad', 'falla', 'reparar', 'arreglar', 'ticket', 'soporte tecnico', 'problema con')) {
    const tipos = [['software', 'Software'], ['hardware', 'Hardware'], ['red', 'Red'], ['internet', 'Red'], ['sap', 'SAP'],
      ['telefon', 'Telefonía'], ['fotocopiadora', 'Fotocopiadora'], ['impresora', 'Impresora'], ['imprime', 'Impresora'], ['ups', 'UPS']];
    const hallado = tipos.find(([p]) => new RegExp(`\\b${p}`).test(t));
    return ['soporte', hallado?.[1] ?? null];
  }
  if ((pide || tiene('me falta', 'se acabo', 'se termino')) && tiene('insumo', 'toner', 'mouse', 'raton', 'teclado', 'bateria', 'tinta', 'cartucho')) {
    if (tiene('toner')) return ['insumos', 'Toner'];
    if (tiene('mouse', 'raton')) return ['insumos', 'Mouse'];
    if (tiene('teclado')) return ['insumos', 'Teclado'];
    if (tiene('bateria')) return ['insumos', 'Baterías de UPS'];
    if (tiene('tinta hp')) return ['insumos', 'Tinta HP'];
    if (tiene('tinta epson')) return ['insumos', 'Tinta Epson'];
    return ['insumos', null];
  }
  if (tiene('usuario nuevo', 'nuevo usuario', 'crear usuario', 'crear un usuario', 'eliminar usuario', 'modificar usuario')) return ['usuario', null];
  return ['conversacion', null];
}

/* ------------------------------ herramientas del panel ------------------------------ */
/** Quita el bloqueo por cuota y vuelve a intentar la búsqueda. */
export function desbloquear() {
  for (const k of Object.keys(agotado)) delete agotado[k];
  for (const k of Object.keys(ultimoError)) delete ultimoError[k];
  busquedaRechazada = false;
}

/** Modelos disponibles en el proveedor (con los datos guardados o con los que se están editando). */
export async function listarModelos(proveedor, prueba = {}) {
  if (proveedor === 'local') {
    const url = sinBarra(prueba.url || cfg.local().url);
    if (!url) throw new Error('Indique la dirección de Ollama');
    const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Ollama respondió HTTP ${r.status}`);
    return ((await r.json()).models ?? []).map((m) => m.name).sort();
  }
  const c = cfg.nube();
  const url = sinBarra(prueba.url || c.url);
  const clave = prueba.clave || c.clave;
  if (!url || !clave) throw new Error('Indique la dirección y la clave del servicio');
  const r = await fetch(`${url}/models`, { headers: { Authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`El servicio respondió HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
  const data = await r.json();
  return (data.data ?? data.models ?? []).map((m) => m.id ?? m.name).filter(Boolean).sort();
}

/** Pregunta de prueba a un proveedor concreto, sin gastar cupo de nadie. */
export async function probar(proveedor) {
  if (!configurado[proveedor]?.()) return { ok: false, error: 'No está configurado' };
  const inicio = Date.now();
  try {
    const r = await LLAMAR[proveedor](
      [{ role: 'system', content: 'Responde en español, en una sola frase corta.' }, { role: 'user', content: 'Saluda y di qué modelo eres.' }],
      { maxTokens: 300, tiempo: 60_000 },
    );
    delete ultimoError[proveedor];
    return { ok: true, texto: r.texto, ms: Date.now() - inicio, busco: r.busco ?? false };
  } catch (err) {
    const mensaje = err.name === 'TimeoutError' ? 'tiempo de espera agotado' : err.message;
    ultimoError[proveedor] = { mensaje: mensaje.slice(0, 240), fecha: new Date().toISOString() };
    return { ok: false, error: mensaje, ms: Date.now() - inicio };
  }
}
