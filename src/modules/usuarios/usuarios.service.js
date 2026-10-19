import { badRequest, notFound } from '../../utils/http.js';
import { enviarCorreo } from '../../utils/correo.js';
import { env } from '../../config/env.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './usuarios.repository.js';
import { SAP, SPI, NECESIDADES, MODULOS_SAP, MODULOS_SPI, COMUNICACION, OTROS_SISTEMAS } from './usuarios.constantes.js';

const ZONA = 'America/Caracas';
const hoyDMY = () => new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/*
 * Lo que las tablas no guardan (cédula del usuario, otros sistemas, observaciones) se conserva
 * unas horas para que la hoja recién emitida salga completa, igual que en permisos.
 */
const extras = new Map();
const HORAS = 12;
function guardarExtras(id, datos) {
  extras.set(id, { ...datos, expira: Date.now() + HORAS * 3600_000 });
  for (const [k, v] of extras) if (v.expira < Date.now()) extras.delete(k);
}

function valores(codigos, mapa, campo) {
  return codigos.map((c) => {
    const o = mapa[c];
    if (!o) throw badRequest('Opción inválida', [{ campo, mensaje: `Opción no reconocida: ${c}` }]);
    return o.valor;
  });
}

/** Button1_Click + guardarSolicitud() + imprimirPdf() de usuarios.aspx. */
export async function crear(d) {
  const emp = await empleados.findByCedula(d.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');

  const sap = valores(d.sap, SAP, 'sap');
  const spi = valores(d.spi, SPI, 'spi');
  const necesidades = valores(d.comunicacion, NECESIDADES, 'comunicacion');
  const otros = d.otrosSistemas.filter((s) => OTROS_SISTEMAS.includes(s));
  const fecha = hoyDMY();
  const solicitante = empleados.nombreLegacy(emp);

  const id = await repo.crear({
    usuario: d.nombreUsuario, cargo: d.cargoUsuario, solicitante, departamento: emp.departamento, fecha, sap, spi, necesidades,
  });
  guardarExtras(id, { cedulaUsuario: d.cedulaUsuario, otros, observaciones: d.observaciones });

  const lista = (titulo, xs) => (xs.length ? `<li>${esc(titulo)}: ${xs.map(esc).join(', ')}</li>` : '');
  const correoEnviado = await enviarCorreo({
    para: env.correo.sistemas,
    asunto: 'Solicitud de Ingreso de Usuario',
    texto: `Solicitud de ingreso de usuario N.º ${id}\nUsuario: ${d.nombreUsuario}\nCargo: ${d.cargoUsuario}\nSolicitante: ${solicitante}\nDepartamento: ${emp.departamento ?? ''}\nFecha: ${fecha}`,
    html: `<html><body>
      <h4>Se ha generado una solicitud de ingreso de usuario con la siguiente información:</h4>
      <ul>
        <li>N.º de solicitud: ${id}</li>
        <li>Tipo de solicitud: Creación de usuario</li>
        <li>Usuario: ${esc(d.nombreUsuario)}${d.cedulaUsuario ? ` (C.I. ${esc(d.cedulaUsuario)})` : ''}</li>
        <li>Cargo: ${esc(d.cargoUsuario)}</li>
        <li>Solicitante: ${esc(solicitante)}</li>
        <li>Departamento: ${esc(emp.departamento)}</li>
        <li>Fecha de solicitud: ${esc(fecha)}</li>
        ${lista('Comunicación', necesidades)}${lista('SAP', sap)}${lista('SPI', spi)}${lista('Otros sistemas', otros)}
        ${d.observaciones ? `<li>Observaciones: ${esc(d.observaciones)}</li>` : ''}
      </ul></body></html>`,
  });

  return {
    id,
    numero: String(id).padStart(6, '0'),
    estado: 'REGISTRADA',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    correoEnviado,
    pdfUrl: `/api/solicitudes/usuarios/${id}/pdf`,
  };
}

/** Datos para la hoja: todas las opciones, marcando las elegidas. */
export async function datosHoja(id) {
  const s = await repo.obtener(id);
  if (!s) throw notFound('La solicitud de usuario no existe');
  const ex = extras.get(id) ?? {};
  const marcar = (lista, elegidos) => lista.map((o) => ({ nombre: o.nombre, marcado: elegidos.includes(o.valor) }));
  return {
    ...s,
    cedulaUsuario: ex.cedulaUsuario ?? null,
    observaciones: ex.observaciones ?? null,
    comunicacion: COMUNICACION.map((g) => ({ grupo: g.grupo, opciones: marcar(g.opciones, s.necesidades) })),
    sap: marcar(MODULOS_SAP, s.sap),
    spi: marcar(MODULOS_SPI, s.spi),
    otros: ex.otros ? OTROS_SISTEMAS.map((n) => ({ nombre: n, marcado: ex.otros.includes(n) })) : null,
  };
}
