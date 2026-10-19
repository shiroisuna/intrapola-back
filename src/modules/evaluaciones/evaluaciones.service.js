import { HttpError, badRequest, notFound } from '../../utils/http.js';
import { enviarCorreo } from '../../utils/correo.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './evaluaciones.repository.js';
import { EVALUACIONES, resultado, puntajeMaximo } from './evaluaciones.config.js';

const normalizarRif = (r) => String(r).toUpperCase().replace(/[^A-Z0-9]/g, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function evaluacion(clave) {
  const e = EVALUACIONES[clave];
  if (!e) throw notFound('Tipo de evaluación no disponible');
  return e;
}

export async function proveedor(rif) {
  const p = await repo.proveedorPorRif(normalizarRif(rif));
  if (!p) throw notFound('No hay un proveedor registrado con ese RIF');
  return p;
}

export const contratoEvaluado = async (contrato) => ({ existe: await repo.existeContrato(contrato.trim()) });

/**
 * Número de evaluación de transporte (eval_prov_pt.aspx): últimos 4 dígitos del código del proveedor + yy + MM.
 * En el C# fallaba si el código tenía menos de 4 caracteres; aquí se completa con ceros.
 */
export function numeroTransporte(codigo, fecha) {
  const cod = String(codigo ?? '').replace(/\s/g, '').slice(-4).padStart(4, '0');
  return `${cod}${fecha.slice(2, 4)}${fecha.slice(5, 7)}`;
}

export async function numeroAutomatico(clave, { rif, fecha }) {
  const e = evaluacion(clave);
  if (!e.numeroAutomatico) throw badRequest('Esta evaluación no genera número automático');
  const p = await proveedor(rif);
  const contrato = numeroTransporte(p.codigo, fecha);
  return { contrato, existe: await repo.existeContrato(contrato) };
}

/** Correo al proveedor con su resultado (enviarEmail de eval_prov_pt.aspx, corregido). */
async function notificarProveedor({ correo, proveedor: nombre, puntuacion, maximo, res, observaciones }) {
  const obs = res.categoria === 'EXCELENTE'
    ? 'Sin ninguna observación que acotar.'
    : `Esto debido a la siguiente observación: ${esc(observaciones || 'sin observaciones registradas')}.`;
  return enviarCorreo({
    para: correo,
    remitente: 'Información Amapola',
    asunto: 'Evaluación de Proveedores de Transporte',
    texto: `Estimado ${nombre}, usted ha sido evaluado por el servicio prestado en Industrias Amapola, C.A., obteniendo ${puntuacion} de ${maximo} puntos, lo cual lo clasifica dentro de nuestra categoría: ${res.categoria}. ${obs.replace(/<[^>]+>/g, '')}`,
    html: `<p>Estimado <strong>${esc(nombre)}</strong>, usted ha sido evaluado por el servicio prestado en Industrias Amapola, C.A.,
      obteniendo la siguiente puntuación: <strong>${puntuacion} PTS</strong> de ${maximo}, lo cual lo clasifica dentro de nuestra categoría:
      <strong>${res.categoria}</strong>. ${obs}</p>`,
  });
}

/**
 * Guardado común a las tres evaluaciones. Se valida todo en el servidor:
 * cada pregunta respondida, puntos entre 0 y el máximo, y 0 si "no cumple".
 */
export async function crear(clave, d) {
  const e = evaluacion(clave);
  const preguntas = e.secciones.flatMap((s, i) => s.preguntas.map((p, j) => ({ ...p, id: `${i}.${j}`, seccion: s.nombre })));

  const respuestas = preguntas.map((p) => {
    const r = d.respuestas[p.id];
    if (!r || typeof r.cumple !== 'boolean') throw badRequest(`Falta responder: ${p.texto}`);
    const puntos = r.cumple ? Number(r.puntos) : 0;
    if (!Number.isInteger(puntos) || puntos < 0 || puntos > p.max) throw badRequest(`La puntuación de "${p.texto}" debe estar entre 0 y ${p.max}`);
    return { pregunta: p.valor, seccion: p.seccion, cumple: r.cumple, puntos };
  });

  const prov = await repo.proveedorPorRif(normalizarRif(d.rif));
  if (!prov) throw badRequest('No hay un proveedor registrado con ese RIF', [{ campo: 'rif', mensaje: 'Proveedor no encontrado' }]);
  const emp = await empleados.findByCedula(d.cedulaEvaluador);
  if (!emp) throw badRequest('La cédula del evaluador no existe en el SPI', [{ campo: 'cedulaEvaluador', mensaje: 'Cédula no encontrada' }]);

  const contrato = e.numeroAutomatico ? numeroTransporte(prov.codigo, d.fecha) : d.contrato;
  if (!contrato) throw badRequest('Indique el contrato u orden', [{ campo: 'contrato', mensaje: 'Indique el contrato u orden' }]);
  if (d.cantRechazada != null && d.cantSuministrada != null && Number(d.cantRechazada) > Number(d.cantSuministrada)) {
    throw badRequest('La cantidad rechazada no puede ser mayor que la suministrada', [{ campo: 'cantRechazada', mensaje: 'No puede ser mayor que la suministrada' }]);
  }

  const maximo = puntajeMaximo(e);
  const puntuacion = respuestas.reduce((n, r) => n + r.puntos, 0);
  const res = resultado(puntuacion, maximo);
  try {
    await repo.crear({
      tipo: e.tipo ?? d.tipoProveedor,
      fecha: d.fecha,
      rif: prov.rif,
      codigo: prov.codigo,
      contrato,
      factura: d.factura,
      descripcion: e.numeroAutomatico ? '0' : d.descripcion,
      cantSuministrada: d.cantSuministrada ?? 0,
      cantRechazada: d.cantRechazada ?? 0,
      lote: d.lote,
      observaciones: d.observaciones,
      puntuacion,
      resultado: res.decision,
      evaluador: empleados.nombreLegacy(emp),
      cargo: emp.cargo,
      departamento: emp.departamento,
      respuestas,
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 409 && e.numeroAutomatico) {
      throw new HttpError(409, 'Este proveedor ya tiene una evaluación de transporte en ese mes', [{ campo: 'contrato', mensaje: 'Ya evaluado en este período' }]);
    }
    throw err;
  }

  const correoEnviado = e.notificarProveedor && d.correo
    ? await notificarProveedor({ correo: d.correo, proveedor: prov.nombre, puntuacion, maximo, res, observaciones: d.observaciones })
    : null;

  return {
    numero: contrato,
    etiquetaNumero: e.numeroAutomatico ? 'N.º de evaluación' : 'Contrato / orden evaluado',
    estado: 'REGISTRADA',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    proveedor: prov.nombre,
    puntuacion,
    maximo,
    ...res,
    correoEnviado,
    pdfUrl: `/api/evaluaciones/${clave}/pdf?contrato=${encodeURIComponent(contrato)}`,
  };
}

/** Datos para la hoja: preguntas del formulario con lo respondido. */
export async function datosHoja(clave, contrato) {
  const e = evaluacion(clave);
  const ev = await repo.obtener(contrato);
  if (!ev) throw notFound('No hay una evaluación con ese número');
  const porPregunta = new Map(ev.respuestas.map((r) => [r.pregunta.trim().toLowerCase(), r]));
  const secciones = e.secciones.map((s) => ({
    nombre: s.nombre,
    preguntas: s.preguntas.map((p) => {
      const v = p.valor.trim().toLowerCase();
      // Si la columna es corta la pregunta quedó guardada recortada: se busca por el inicio
      const r = porPregunta.get(v) ?? ev.respuestas.find((x) => x.pregunta.trim().length >= 20 && v.startsWith(x.pregunta.trim().toLowerCase()));
      return { texto: p.texto, max: p.max, cumple: r ? r.cumple === 'SI' : null, puntos: r ? Number(r.puntos) || 0 : null };
    }),
  }));
  const maximo = puntajeMaximo(e);
  const puntuacion = Number(ev.puntuacion) || secciones.flatMap((s) => s.preguntas).reduce((n, p) => n + (p.puntos ?? 0), 0);
  // Campos de cabecera propios de esta evaluación (para la hoja)
  const valores = { ...ev, tipoProveedor: ev.tipo };
  const extras = e.campos
    .filter((c) => !['contrato', 'factura', 'correo'].includes(c.nombre))
    .map((c) => ({ etiqueta: c.etiqueta, valor: valores[c.nombre] }));
  return { ...ev, formato: e.formato, numeroAutomatico: Boolean(e.numeroAutomatico), secciones, puntuacion, maximo, extras, ...resultado(puntuacion, maximo), resultado: ev.resultado };
}
