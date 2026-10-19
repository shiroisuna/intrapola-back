import * as empleados from '../empleados/empleados.repository.js';
import * as permisos from '../permisos/permisos.repository.js';
import { duracionTexto } from '../permisos/permisos.constantes.js';
import * as papeleria from '../papeleria/papeleria.repository.js';
import * as rrhh from '../rrhh/rrhh.repository.js';
import { tipoPorValor } from '../rrhh/rrhh.constantes.js';
import * as vacaciones from '../vacaciones/vacaciones.repository.js';
import * as anticipos from '../anticipos/anticipos.repository.js';
import * as soporte from '../soporte/soporte.repository.js';
import * as usuariosSol from '../usuarios/usuarios.repository.js';
import { nombreLegacy } from '../empleados/empleados.repository.js';
import * as relgastos from '../relgastos/relgastos.repository.js';
import * as salidas from '../salidas/salidas.repository.js';
import * as materiales from '../materiales/materiales.repository.js';
import { TIPOS as TIPOS_MAT, ESTADOS as ESTADOS_MAT } from '../materiales/materiales.constantes.js';
import { aNumero } from '../relgastos/relgastos.service.js';

/*
 * "Mis solicitudes": junta lo que cada tipo tiene guardado en SUS tablas reales.
 * Cada fuente recibe { cedula, empleado, limite } y devuelve filas con el mismo formato:
 *   { clave, numero, tipo, area, descripcion, fecha, estado, pdfUrl }
 * Al adaptar otro formulario (RRHH, soporte, ...) basta con agregar su fuente aquí.
 *
 * permisos, papelería y vacaciones no guardan estado de aprobación: se muestran como "Registrada".
 * solrrhh sí tiene estadosolrrhh y se muestra tal cual.
 */
const FUENTES = [
  {
    nombre: 'permisos',
    necesitaEmpleado: true, // la tabla guarda la ficha, que viene del SPI
    async listar({ empleado, limite }) {
      if (!empleado?.ficha) return [];
      const filas = await permisos.historial(empleado.ficha, limite);
      return filas.map((p) => ({
        clave: `permiso-${p.id}`,
        numero: p.id,
        tipo: 'Permiso individual',
        fechaTipo: 'para', // es la fecha del permiso, no la de registro
        area: 'RRHH',
        descripcion: [p.tipoPermiso, duracionTexto(p.tiempo, p.medida), p.motivo].filter(Boolean).join(' · '),
        fecha: p.fecha,
        estado: 'REGISTRADA',
        pdfUrl: `/api/solicitudes/permisos/${p.id}/pdf`,
      }));
    },
  },
  {
    nombre: 'papeleria',
    async listar({ cedula, limite }) {
      const filas = await papeleria.historial(cedula, limite);
      return filas.map((s) => ({
        clave: `papeleria-${s.numero}`,
        numero: s.numero,
        tipo: 'Papelería',
        area: 'SERVICIOS',
        descripcion: `${s.cantidad} ${s.cantidad === 1 ? 'artículo' : 'artículos'}`
          + (s.unidades ? ` · ${s.unidades} ${s.unidades === 1 ? 'unidad' : 'unidades'}` : ''),
        fecha: s.fecha,
        estado: 'REGISTRADA',
        pdfUrl: `/api/solicitudes/papeleria/${s.numero}/pdf`,
      }));
    },
  },
  {
    nombre: 'RRHH',
    async listar({ cedula, limite }) {
      const filas = await rrhh.historial(cedula, limite);
      return filas.map((r) => ({
        clave: `rrhh-${r.id}`,
        numero: r.id,
        tipo: tipoPorValor(r.tipo)?.nombre ?? r.tipo ?? 'Recursos Humanos',
        area: 'RRHH',
        descripcion: r.observacion,
        fecha: r.fecha,
        estado: r.estado || 'PENDIENTE',
        pdfUrl: null,
      }));
    },
  },
  {
    nombre: 'vacaciones',
    async listar({ cedula, limite }) {
      const filas = await vacaciones.historial(cedula, limite);
      return filas.map((v) => ({
        clave: `vacaciones-${v.inicio}-${v.fechaSol}`,
        numero: null,
        tipo: 'Vacaciones',
        area: 'RRHH',
        descripcion: `${v.dias} días · del ${v.inicio.split('-').reverse().join('/')} al ${v.fin?.split('-').reverse().join('/')}`
          + (v.periodo ? ` · período ${v.periodo}` : ''),
        fecha: v.fechaSol,
        estado: 'REGISTRADA',
        pdfUrl: `/api/solicitudes/vacaciones/pdf?cedula=${cedula}&inicio=${v.inicio}`,
      }));
    },
  },
  {
    nombre: 'anticipos',
    async listar({ cedula, limite }) {
      const filas = await anticipos.historial(cedula, limite);
      return filas.map((a) => {
        const n = Number(String(a.monto).replace(',', '.'));
        const monto = Number.isFinite(n) ? n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : a.monto;
        return {
          clave: `anticipo-${a.fecha}`,
          numero: null,
          tipo: 'Anticipo de prestaciones',
          area: 'RRHH',
          descripcion: `Monto solicitado: ${monto}`,
          fecha: a.fecha,
          estado: 'REGISTRADA',
          pdfUrl: null,
        };
      });
    },
  },
  {
    nombre: 'soporte',
    necesitaEmpleado: true, // la tabla guarda "NOMBRE-APELLIDO", que viene del SPI
    async listar({ empleado, limite }) {
      const filas = await soporte.historial(nombreLegacy(empleado), limite);
      return filas.map((s) => ({
        clave: `soporte-${s.id}`,
        numero: s.id,
        tipo: `Soporte · ${s.tipo}`,
        area: 'SISTEMAS',
        descripcion: s.descripcion,
        fecha: s.fecha,
        estado: s.estado || 'PENDIENTE',
        pdfUrl: null,
      }));
    },
  },
  {
    nombre: 'usuarios',
    necesitaEmpleado: true,
    async listar({ empleado, limite }) {
      const filas = await usuariosSol.historial(nombreLegacy(empleado), limite);
      const iso = (f) => (/^\d{2}\/\d{2}\/\d{4}$/.test(f ?? '') ? f.split('/').reverse().join('-') : f);
      return filas.map((u) => ({
        clave: `usuario-${u.id}`,
        numero: u.id,
        tipo: 'Usuario nuevo',
        area: 'SISTEMAS',
        descripcion: [u.usuario, u.cargo].filter(Boolean).join(' · '),
        fecha: iso(u.fecha),
        estado: 'REGISTRADA',
        pdfUrl: `/api/solicitudes/usuarios/${u.id}/pdf`,
      }));
    },
  },
  {
    nombre: 'relación de gastos',
    async listar({ cedula, limite }) {
      const filas = await relgastos.historial(cedula, limite);
      return filas.map((r) => ({
        clave: `relgasto-${r.numero}`,
        numero: Number(r.numero) || null,
        tipo: 'Relación de gastos',
        area: 'ADMINISTRACION',
        descripcion: [r.concepto, `Total ${aNumero(r.totalGasto).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`].filter(Boolean).join(' · '),
        fecha: r.fecha,
        estado: 'REGISTRADA',
        pdfUrl: `/api/formatos/relacion-gastos/${r.numero}/pdf`,
      }));
    },
  },
  {
    nombre: 'salida de materiales',
    necesitaEmpleado: true, // autsalidas guarda "NOMBRE-APELLIDO", no la cédula
    async listar({ empleado, limite }) {
      const filas = await salidas.historial(nombreLegacy(empleado), limite);
      const dmy = (f) => (f ? f.split('-').reverse().join('/') : '');
      return filas.map((s) => ({
        clave: `salida-${s.numero}`,
        numero: Number(s.numero) || null,
        tipo: 'Salida de materiales',
        area: 'OPERACIONES',
        descripcion: [`Retira: ${s.retira}`, `Sale ${dmy(s.fechaSalida)}`, s.fechaRetorno ? `retorna ${dmy(s.fechaRetorno)}` : 'sin retorno'].join(' · '),
        fecha: s.fecha,
        estado: 'REGISTRADA',
        pdfUrl: `/api/formatos/salida-materiales/${s.numero}/pdf`,
      }));
    },
  },
  {
    nombre: 'materiales SAP',
    async listar({ cedula, limite }) {
      const filas = await materiales.historial(cedula, limite);
      return filas.map((m) => ({
        clave: `material-${m.id}`,
        numero: m.id,
        tipo: `Material SAP · ${TIPOS_MAT.find((t) => t.valor === m.solicitud)?.texto ?? m.solicitud}`,
        area: 'OPERACIONES',
        descripcion: [m.material, m.codigo && `Código ${m.codigo}`].filter(Boolean).join(' · '),
        fecha: m.fecha,
        estado: ESTADOS_MAT[m.estado] ?? m.estado ?? 'PENDIENTE',
        pdfUrl: null,
      }));
    },
  },
];

/**
 * Devuelve { solicitudes, avisos }. Si una fuente falla (p. ej. el SPI no responde)
 * se muestran las demás y se avisa cuál no se pudo consultar.
 */
export async function misSolicitudes({ cedula, limite = 30 }) {
  const avisos = [];
  let empleado = null;
  try {
    empleado = await empleados.findByCedula(cedula);
  } catch (err) {
    console.warn(`[historial] SPI: ${err.message}`);
    avisos.push('No se pudo consultar el SPI; los permisos no aparecen por ahora.');
  }

  const activas = FUENTES.filter((f) => !f.necesitaEmpleado || empleado);
  const resultados = await Promise.allSettled(activas.map((f) => f.listar({ cedula, empleado, limite })));
  const solicitudes = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') solicitudes.push(...r.value);
    else {
      console.warn(`[historial] ${activas[i].nombre}: ${r.reason?.message}`);
      avisos.push(`No se pudieron consultar las solicitudes de ${activas[i].nombre}.`);
    }
  });

  solicitudes.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { solicitudes: solicitudes.slice(0, limite), avisos };
}
