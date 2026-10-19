import { badRequest, notFound } from '../../utils/http.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './vacaciones.repository.js';

/*
 * Cálculo igual al de svacaciones.aspx:
 *   antigüedad = año actual − año de ingreso
 *   días       = 15 + antigüedad − 1
 *   feriados   = feriados entre la salida y salida + días
 *   total      = sábados y domingos en ese mismo rango
 *   reintegro  = FECHAFINVACACIONES de sp_calculodiasvacaciones
 */
export const DIAS_BASE = 15;

const DIA_MS = 86_400_000;
const aISO = (d) => d.toISOString().slice(0, 10);
const sumarDias = (iso, n) => aISO(new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS));
const hoyCaracas = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

function contarFinesDeSemana(desde, hasta) {
  let n = 0;
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += DIA_MS) {
    const dia = new Date(t).getUTCDay();
    if (dia === 0 || dia === 6) n += 1;
  }
  return n;
}

const aFechaSql = (iso) => new Date(`${iso}T00:00:00Z`);
const fechaDeSp = (v) => (v instanceof Date ? aISO(v) : v ? String(v).slice(0, 10) : null);

export async function calcular({ cedula, inicio }) {
  const emp = await empleados.findByCedula(cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  if (!emp.fechaIngreso) throw badRequest('El trabajador no tiene fecha de ingreso en el SPI');

  const antiguedad = Number(hoyCaracas().slice(0, 4)) - Number(emp.fechaIngreso.slice(0, 4));
  const dias = DIAS_BASE + antiguedad - 1;
  if (dias < 1) throw badRequest('El trabajador todavía no tiene días de vacaciones según su fecha de ingreso');

  const hasta = sumarDias(inicio, dias);
  const feriados = await repo.contarFeriados(aFechaSql(inicio), aFechaSql(hasta));
  const finesDeSemana = contarFinesDeSemana(inicio, hasta);

  const sp = await repo.calcularDias({ feriados, inicio: aFechaSql(inicio), dias });
  const reintegro = fechaDeSp(sp?.FECHAFINVACACIONES);
  if (!reintegro) throw new Error('sp_calculodiasvacaciones no devolvió la fecha de reintegro');

  return {
    empleado: emp,
    fechaIngreso: emp.fechaIngreso,
    antiguedad,
    diasBase: DIAS_BASE,
    dias,
    inicio,
    feriados,
    finesDeSemana,
    salida: fechaDeSp(sp.FechaSalida) ?? inicio,
    reintegro,
  };
}

export async function crear({ cedula, inicio, periodo }) {
  const c = await calcular({ cedula, inicio }); // se recalcula aquí: no se confía en lo que manda el navegador
  const fechaSol = hoyCaracas();
  await repo.insertar({
    cedula: c.empleado.cedula,
    cargo: c.empleado.cargo,
    antiguedad: c.antiguedad,
    periodo,
    fechaSol: aFechaSql(fechaSol),
    inicio: aFechaSql(inicio),
    fin: aFechaSql(c.reintegro),
    dias: c.dias,
    total: c.finesDeSemana,
  });
  return {
    numero: `${c.dias} días`,
    etiquetaNumero: 'Días de disfrute',
    estado: 'REGISTRADA',
    creadaEn: new Date().toISOString(),
    solicitante: c.empleado.nombreCompleto,
    inicio,
    reintegro: c.reintegro,
    pdfUrl: `/api/solicitudes/vacaciones/pdf?cedula=${c.empleado.cedula}&inicio=${inicio}`,
  };
}

export async function datosHoja({ cedula, inicio }) {
  const v = await repo.obtener(cedula, aFechaSql(inicio));
  if (!v) throw notFound('No hay una solicitud de vacaciones con esa cédula y fecha de salida');
  const emp = await empleados.findByCedula(cedula).catch(() => null);
  return {
    ...v,
    nombre: emp?.nombreCompleto ?? null,
    departamento: emp?.departamento ?? null,
    fechaIngreso: emp?.fechaIngreso ?? null,
    ficha: emp?.ficha ?? null,
  };
}
