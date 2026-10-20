import { CONTEXTO_IA } from './apolin.constantes.js';

/*
 * IA opcional con Ollama, por su API HTTP (sin Python): POST {APOLIN_OLLAMA_URL}/api/chat
 * Si APOLIN_OLLAMA_URL está vacío, Apolin funciona solo con el menú guiado (como chatbot.py).
 */
const url = () => (process.env.APOLIN_OLLAMA_URL || '').replace(/\/+$/, '');
const modelo = () => process.env.APOLIN_OLLAMA_MODELO || 'llama3.2';
export const iaConfigurada = () => Boolean(url());

/** Respuesta corta de la IA, o null si no está configurada, tarda demasiado o falla. */
export async function chatIa(mensaje, historial = []) {
  if (!iaConfigurada()) return null;
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), Number(process.env.APOLIN_OLLAMA_TIMEOUT_MS || 20000));
  try {
    const res = await fetch(`${url()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: control.signal,
      body: JSON.stringify({
        model: modelo(),
        stream: false,
        keep_alive: -1, // OLLAMA_KEEP_ALIVE=-1 del script: el modelo queda en memoria
        messages: [{ role: 'system', content: CONTEXTO_IA }, ...historial.slice(-4), { role: 'user', content: mensaje }],
        options: { num_predict: 80, temperature: 0.7, top_k: 40, top_p: 0.9, num_ctx: 1024 },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const texto = String(data?.message?.content ?? '').trim();
    return texto ? texto.slice(0, 600) : null;
  } catch (err) {
    console.warn(`[apolin] la IA no respondió: ${err.name === 'AbortError' ? 'tiempo de espera agotado' : err.message}`);
    return null;
  } finally {
    clearTimeout(espera);
  }
}

export async function estadoIa() {
  if (!iaConfigurada()) return { configurada: false };
  try {
    const res = await fetch(`${url()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const modelos = (data.models ?? []).map((m) => m.name);
    return { configurada: true, disponible: true, modelo: modelo(), modeloInstalado: modelos.some((m) => m.startsWith(modelo())), modelos };
  } catch (err) {
    return { configurada: true, disponible: false, modelo: modelo(), error: err.message };
  }
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

/* ---- Intención del mensaje (analizar_intencion) ---- */
const sinAcentos = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function analizarIntencion(texto) {
  const t = sinAcentos(texto);
  const tiene = (...p) => p.some((x) => t.includes(x));

  if (tiene('prestamo', 'audifono', 'laptop', 'video beam', 'videobeam', 'equipo prestado', 'me prestas', 'me puedes prestar')) {
    if (tiene('audifono')) return ['prestamo', 'Audifonos'];
    if (tiene('laptop')) return ['prestamo', 'Laptop Presentaciones'];
    if (tiene('video', 'beam')) return ['prestamo', 'Video Beam'];
    return ['prestamo', null];
  }
  if (tiene('soporte', 'problema', 'no funciona', 'no sirve', 'no prende', 'falla', 'error', 'ayuda tecnica', 'reparar', 'arreglar', 'ticket', 'caso')) {
    const tipos = [['software', 'Software'], ['hardware', 'Hardware'], ['red', 'Red'], ['internet', 'Red'], ['sap', 'SAP'],
      ['telefon', 'Telefonía'], ['fotocopiadora', 'Fotocopiadora'], ['impresora', 'Impresora'], ['ups', 'UPS']];
    const hallado = tipos.find(([p]) => new RegExp(`\\b${p}`).test(t));
    return ['soporte', hallado?.[1] ?? null];
  }
  if (tiene('insumo', 'toner', 'mouse', 'raton', 'teclado', 'bateria', 'tinta', 'cartucho', 'me falta')) {
    if (tiene('toner')) return ['insumos', 'Toner'];
    if (tiene('mouse', 'raton')) return ['insumos', 'Mouse'];
    if (tiene('teclado')) return ['insumos', 'Teclado'];
    if (tiene('bateria')) return ['insumos', 'Baterías de UPS'];
    if (tiene('tinta hp')) return ['insumos', 'Tinta HP'];
    if (tiene('tinta epson')) return ['insumos', 'Tinta Epson'];
    return ['insumos', null];
  }
  if (tiene('usuario nuevo', 'nuevo usuario', 'crear usuario', 'eliminar usuario', 'modificar usuario', 'usuario')) return ['usuario', null];
  return ['conversacion', null];
}
