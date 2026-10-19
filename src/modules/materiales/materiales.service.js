import { badRequest, notFound } from '../../utils/http.js';
import { enviarCorreo } from '../../utils/correo.js';
import { env } from '../../config/env.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './materiales.repository.js';
import { TIPOS, VERIFICACION } from './materiales.constantes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** La aprobación sigue en la Intrapola actual (form_modcrmddemat.aspx) hasta que se migre. */
const enlaceAprobacion = (id) => `${env.legacyBaseUrl}${env.legacyAppPath}/formatos/form_modcrmddemat.aspx?id=${id}`;

export async function crear(d) {
  const tipo = TIPOS.find((t) => t.valor === d.solicitud);
  const verif = VERIFICACION.find((v) => v.valor === d.existe);
  if (!tipo || !verif) throw badRequest('Opción inválida');
  if (verif.conCodigo && !d.codigo) {
    throw badRequest('Indique el código del material', [{ campo: 'codigo', mensaje: 'Indique el código SAP del material' }]);
  }

  const emp = await empleados.findByCedula(d.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');

  const id = await repo.crear({
    ...d,
    cedula: emp.cedula,
    nombre: empleados.nombreLegacy(emp),
    departamento: emp.departamento,
    codigo: verif.conCodigo ? d.codigo : '',
  });

  // Mismo correo que EnviarCorreoGerMant: asunto "<tipo> de Material" y enlace para aprobar
  const enlace = enlaceAprobacion(id);
  const filas = [
    ['N.º de solicitud', id], ['Tipo de solicitud', tipo.texto], ['Material', d.material],
    ['¿Existe en SAP?', verif.texto], ['Código', verif.conCodigo ? d.codigo : 'S/C'], ['Código anterior', d.codigoAnterior],
    ['Almacén', d.almacen], ['Unidad de medida', d.um], ['Grupo de compras', d.grCompras], ['Grupo de artículos', d.grArt],
    ['Punto de pedido', d.ptoPedido], ['Máximo', d.max], ['Stock de seguridad', d.stockSeg],
    ['Motivo', d.motivo], ['Observaciones C-M-D', d.observaciones], ['Observaciones de planificación', d.obsPlanificacion],
    ['Solicitante', `${emp.nombreCompleto} (C.I. ${emp.cedula}) · ${emp.departamento ?? ''}`], ['Autorizado por', d.autoriza],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');
  const correoEnviado = await enviarCorreo({
    para: env.correo.materialesSap,
    asunto: `${tipo.valor} de Material`,
    texto: `Solicitud de ${tipo.texto} de material en SAP: ${d.material}\nAprobar: ${enlace}\n\n${filas.map(([k, v]) => `${k}: ${v}`).join('\n')}`,
    html: `<html><body>
      <p>Se ha enviado un enlace para aprobar la solicitud de <b>${esc(tipo.texto)}</b> en SAP del material <b>${esc(d.material)}</b>. Ingrese aquí:</p>
      <p><a href="${esc(enlace)}">${esc(enlace)}</a></p>
      <h4>Solicitud de ${esc(tipo.texto)} de material</h4>
      <table border="1" cellpadding="6" style="border-collapse:collapse;">
        ${filas.map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
      </table></body></html>`,
  });

  return {
    id,
    numero: String(id).padStart(6, '0'),
    estado: 'PENDIENTE',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    correoEnviado,
  };
}
