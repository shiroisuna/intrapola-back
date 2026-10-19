import { notFound } from '../../utils/http.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './relgastos.repository.js';

/** Tipos de gasto de la lista del formulario actual. Se completan con los ya usados en det_relgasto. */
export const TIPOS_BASE = ['Alimentacion y Refrigerios'];

export async function tipos() {
  const usados = await repo.tiposUsados().catch(() => []);
  return [...new Set([...TIPOS_BASE, ...usados])];
}

/** Lee montos guardados como texto ("1.234,50", "1,234.50" o "1234.5"). */
export function aNumero(texto) {
  if (texto == null || texto === '') return 0;
  let t = String(texto).replace(/[^\d.,-]/g, '');
  const ultimo = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
  if (ultimo !== -1 && /^\d{1,2}$/.test(t.slice(ultimo + 1))) t = `${t.slice(0, ultimo).replace(/[.,]/g, '')}.${t.slice(ultimo + 1)}`;
  else t = t.replace(/[.,]/g, '');
  return Number(t) || 0;
}

/** sumargrid(): saldo = anticipo − gastos; si es negativo, es a favor del trabajador. */
export function calcularSaldos(anticipo, gastos) {
  const centavos = (n) => Math.round(n * 100);
  const total = gastos.reduce((s, g) => s + centavos(g.monto), 0);
  const dif = centavos(anticipo) - total;
  return {
    totalGasto: total / 100,
    saldoEmpresa: dif > 0 ? dif / 100 : 0,
    saldoEmpleado: dif < 0 ? -dif / 100 : 0,
  };
}

export async function crear(d) {
  const emp = await empleados.findByCedula(d.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const s = calcularSaldos(d.anticipo, d.gastos);
  const numero = await repo.crear({
    cedula: emp.cedula,
    empleado: empleados.nombreLegacy(emp),
    departamento: emp.departamento,
    concepto: d.concepto,
    observaciones: d.observaciones,
    anticipo: d.anticipo,
    gastos: d.gastos,
    ...s,
  });
  return {
    id: numero,
    numero: String(numero).padStart(6, '0'),
    estado: 'REGISTRADA',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    ...s,
    pdfUrl: `/api/formatos/relacion-gastos/${numero}/pdf`,
  };
}

export async function datosHoja(numero) {
  const r = await repo.obtener(numero);
  if (!r) throw notFound('La relación de gastos no existe');
  const gastos = r.gastos.map((g) => ({ ...g, monto: aNumero(g.monto) }));
  const anticipo = aNumero(r.anticipo);
  // Se recalcula con los renglones (la tabla no guarda el saldo a favor del trabajador)
  return { ...r, gastos, anticipo, ...calcularSaldos(anticipo, gastos) };
}
