import { badRequest, notFound } from '../../utils/http.js';
import { enviarCorreo } from '../../utils/correo.js';
import { env } from '../../config/env.js';
import { fechaHoraActual } from '../../utils/pdf.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './rrhh.repository.js';
import { tipoPorCodigo } from './rrhh.constantes.js';

/** Guarda en solrrhh y avisa por correo a RRHH (como Button2_Click + EnviarCorreo). */
export async function crear({ cedula, tipoCodigo, descripcion }) {
  const tipo = tipoPorCodigo(tipoCodigo);
  if (!tipo) throw badRequest('Tipo de solicitud inválido', [{ campo: 'tipoCodigo', mensaje: 'Seleccione qué necesita' }]);
  if (tipo.formulario !== 'GENERAL') {
    throw badRequest(`"${tipo.nombre}" tiene su propio formulario`, [{ campo: 'tipoCodigo', mensaje: `Use el formulario de ${tipo.nombre.toLowerCase()}` }]);
  }

  const emp = await empleados.findByCedula(cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');

  const id = await repo.insertar({
    tipo: tipo.valor,
    departamento: emp.departamento,
    cargo: emp.cargo,
    cedula: emp.cedula,
    nombre: emp.nombres,
    apellido: emp.apellidos,
    observacion: descripcion,
  });

  // Mismo asunto y cuerpo que el correo actual
  const correoEnviado = await enviarCorreo({
    para: env.correo.rrhh,
    asunto: `Solicitudes - RRHH ${tipo.valor}`,
    texto: [
      `FECHA SOLICITUD: ${fechaHoraActual()}`,
      `TIPO DE SOLICITUD: ${tipo.valor}`,
      `SOLICITANTE: ${emp.nombres} - ${emp.apellidos}`,
      `CÉDULA: ${emp.cedula}`,
      `DEPARTAMENTO: ${emp.departamento ?? ''}`,
      `SOLICITUD: ${descripcion}`,
      '',
      `N.º de solicitud: ${id}`,
    ].join('\n'),
  });

  return {
    id,
    numero: String(id).padStart(6, '0'),
    tipo: tipo.nombre,
    estado: 'PENDIENTE',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    correoEnviado,
  };
}
