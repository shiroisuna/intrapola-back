import { HttpError, badRequest, notFound } from '../../utils/http.js';
import { enviarCorreo } from '../../utils/correo.js';
import { env } from '../../config/env.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './anticipos.repository.js';
import { buscarEnPlanilla, paginaPdf } from './anticipos.planilla.js';
import { crearToken, verificarBloqueo, registrarFallo, limpiarFallos } from './anticipos.sesion.js';
import { DIA_LIMITE, MESES_CIERRE_TRIMESTRE, ANIO_CORTE_INGRESO, tipoNomina } from './anticipos.constantes.js';

const ZONA = 'America/Caracas';
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA }); // YYYY-MM-DD
const diaDelMes = () => Number(hoy().slice(8, 10));
const mesDelAnio = () => Number(hoy().slice(5, 7));

/** validarfecha(): del 1 al 10 de cada mes. */
export const estado = () => ({ abierto: diaDelMes() <= DIA_LIMITE, diaLimite: DIA_LIMITE, hoy: hoy() });

function exigirPeriodoAbierto() {
  if (!estado().abierto) {
    throw new HttpError(403, `Las solicitudes de anticipo se hacen del 1 al ${DIA_LIMITE} de cada mes.`);
  }
}

/**
 * validarsiono() + validarinterno():
 *  - sin anticipos anteriores → puede solicitar
 *  - con anticipos → según el reloj de asistencia: meses desde el ingreso (hasta el mes pasado) múltiplo de 3,
 *    o haber ingresado después de 2012 y estar en marzo, junio, septiembre o diciembre
 */
async function cumpleTrimestre(cedula) {
  if ((await repo.contarSolicitudes(cedula)) === 0) return true;
  const ingreso = await repo.ingresoAsistencia(cedula);
  if (!ingreso) return true; // igual que el C#: si no está en el reloj no se bloquea
  if (ingreso.anioIngreso > ANIO_CORTE_INGRESO && MESES_CIERRE_TRIMESTRE.includes(mesDelAnio())) return true;
  return ingreso.meses % 3 === 0;
}

/** Datos del SPI para el formulario de registro (CargarDatosSolicitante de portal_solic). */
export async function datosRegistro(cedula) {
  const emp = await empleados.findByCedula(cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const [correo, registrado] = await Promise.all([
    empleados.correoPorCedula(cedula).catch(() => null),
    repo.existeUsuario(cedula),
  ]);
  return {
    cedula: emp.cedula,
    nombre: emp.nombres,
    apellido: emp.apellidos,
    departamento: emp.departamento,
    cargo: emp.cargo,
    nomina: emp.nomina,
    correo,
    registrado,
  };
}

/** btnRegister_Click: crea el acceso al portal con los datos del SPI. */
export async function registrar({ cedula, clave, correo }) {
  const emp = await empleados.findByCedula(cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  if (await repo.existeUsuario(cedula)) throw new HttpError(409, 'Esta cédula ya tiene usuario. Ingrese con su clave.');
  await repo.registrarUsuario({
    cedula: emp.cedula,
    clave,
    nombre: emp.nombres,
    apellido: emp.apellidos,
    correo,
    departamento: emp.departamento,
    cargo: emp.cargo,
    tipoNomina: tipoNomina(emp.idNomina),
  });
  return { ok: true };
}

/** btnLogin_Click: valida clave, período y regla trimestral. */
export async function ingresar({ cedula, clave }) {
  exigirPeriodoAbierto();
  verificarBloqueo(cedula);

  const u = await repo.buscarUsuario(cedula, clave);
  if (!u) {
    registrarFallo(cedula);
    throw new HttpError(401, 'Cédula o clave incorrecta, o el usuario no existe.');
  }
  limpiarFallos(cedula);

  if (!(await cumpleTrimestre(u.cedula))) {
    throw new HttpError(403, 'No cumples el tiempo para solicitar anticipo. Podrás hacerlo al cumplir el trimestre.');
  }

  const usuario = { cedula: u.cedula, nombre: `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim(), correo: u.correo };
  return { token: crearToken(usuario), usuario };
}

/** Trimestre calendario en curso (calcularTrimestres del C#: siempre resulta el trimestre actual). */
function trimestreActual() {
  const [a, m] = hoy().split('-').map(Number);
  const mesInicio = Math.floor((m - 1) / 3) * 3 + 1;
  return { inicio: `${a}-${String(mesInicio).padStart(2, '0')}-01`, numero: Math.floor((m - 1) / 3) + 1, anio: a };
}

/** Pantalla de solic_antic_prest.aspx: datos del trabajador + planilla del mes con su saldo. */
export async function panel(usuario) {
  const emp = await empleados.findByCedula(usuario.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const planilla = await buscarEnPlanilla({ cedula: emp.cedula, idNomina: emp.idNomina });
  return {
    usuario,
    empleado: {
      nombreCompleto: emp.nombreCompleto,
      cedula: emp.cedula,
      cargo: emp.cargo,
      ficha: emp.ficha,
      departamento: emp.departamento,
      fechaIngreso: emp.fechaIngreso,
      nomina: emp.nomina,
    },
    trimestre: trimestreActual(),
    planilla,
  };
}

export async function planillaPdf(usuario) {
  const emp = await empleados.findByCedula(usuario.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const p = await buscarEnPlanilla({ cedula: emp.cedula, idNomina: emp.idNomina });
  if (!p.disponible) throw notFound(p.mensaje);
  return paginaPdf({ idNomina: emp.idNomina, pagina: p.pagina });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatoMonto = (n) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** btnSolicitar_Click: guarda la solicitud y avisa a RRHH. */
export async function solicitar(usuario, { monto }) {
  exigirPeriodoAbierto();

  // El C# tenía esta validación comentada; aquí se aplica cuando el saldo se pudo leer de la planilla
  const emp = await empleados.findByCedula(usuario.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const p = await buscarEnPlanilla({ cedula: emp.cedula, idNomina: emp.idNomina });
  if (p.saldo != null && monto > p.saldo) {
    throw badRequest('No puede solicitar un monto mayor al disponible', [
      { campo: 'monto', mensaje: `El máximo disponible es ${formatoMonto(p.saldo)}` },
    ]);
  }

  const montoTexto = monto.toFixed(2); // mismo formato que el C#: punto decimal, sin miles
  const [fila] = await repo.insertarSolicitud({ cedula: usuario.cedula, correo: usuario.correo, monto: montoTexto });
  const fecha = new Date().toLocaleString('es-VE', { timeZone: ZONA });

  const correoEnviado = await enviarCorreo({
    para: env.correo.anticipos,
    remitente: 'Info-RRHH',
    asunto: `Solicitud Anticipo de Prestaciones ${usuario.nombre}`,
    texto: `Se ha realizado una solicitud de Anticipo de Prestaciones\nCédula: ${usuario.cedula}\nMonto: ${formatoMonto(monto)}\nFecha: ${fecha}`,
    html: `<html><body>
      <h1>Se ha realizado una solicitud de Anticipo de Prestaciones</h1>
      <table border="1" cellpadding="6" style="border-collapse:collapse;">
        <tr><td><b>Cédula</b></td><td><b>Nombre</b></td><td><b>Monto</b></td><td><b>Fecha</b></td></tr>
        <tr><td>${esc(usuario.cedula)}</td><td>${esc(usuario.nombre)}</td><td>${esc(formatoMonto(monto))}</td><td>${esc(fecha)}</td></tr>
      </table></body></html>`,
  });

  return {
    numero: formatoMonto(monto),
    etiquetaNumero: 'Monto solicitado',
    estado: 'REGISTRADA',
    creadaEn: fila?.fecha ?? new Date().toISOString(),
    solicitante: usuario.nombre,
    correoEnviado,
  };
}
