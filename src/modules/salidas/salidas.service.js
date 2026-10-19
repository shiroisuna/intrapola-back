import { notFound } from '../../utils/http.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './salidas.repository.js';

/** Button2_Click de aut_salidas.aspx: guarda cabecera y renglones; la hoja sale del número. */
export async function crear(d) {
  const emp = await empleados.findByCedula(d.cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const numero = await repo.crear({
    solicitante: empleados.nombreLegacy(emp),
    departamento: emp.departamento,
    fechaSalida: new Date(`${d.fechaSalida}T00:00:00Z`),
    retorna: d.retorna,
    fechaRetorno: d.retorna ? new Date(`${d.fechaRetorno}T00:00:00Z`) : null,
    retira: d.retira,
    cedulaRetira: d.cedulaRetira,
    observacion: d.observacion,
    items: d.items,
  });
  return {
    id: numero,
    numero: String(numero).padStart(6, '0'),
    estado: 'REGISTRADA',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    pdfUrl: `/api/formatos/salida-materiales/${numero}/pdf`,
  };
}

export async function datosHoja(numero) {
  const s = await repo.obtener(numero);
  if (!s) throw notFound('La autorización de salida no existe');
  return { ...s, retorna: Boolean(s.fechaRetorno) || s.items.some((i) => i.retorno === 'SI') };
}
