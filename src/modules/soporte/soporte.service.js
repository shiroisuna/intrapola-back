import fs from 'node:fs/promises';
import path from 'node:path';
import { badRequest, notFound } from '../../utils/http.js';
import { enviarCorreo } from '../../utils/correo.js';
import { env } from '../../config/env.js';
import * as empleados from '../empleados/empleados.repository.js';
import * as repo from './soporte.repository.js';

/** Quita caracteres que Windows no acepta en nombres de carpeta o archivo (y evita rutas tipo "..\"). */
const nombreSeguro = (s) => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120) || 'archivo';

/**
 * adjuntar() del C#: \\192.168.10.123\tudirectorioenelservidor\<NOMBRE-APELLIDO>\<archivo>
 * Se antepone el número de solicitud para no pisar archivos con el mismo nombre.
 */
async function guardarAdjunto(usuario, numero, archivo) {
  const carpeta = path.join(env.soporte.adjuntos, nombreSeguro(usuario));
  const nombre = `${numero ?? Date.now()}_${nombreSeguro(path.basename(archivo.originalname))}`;
  try {
    await fs.mkdir(carpeta, { recursive: true });
    await fs.writeFile(path.join(carpeta, nombre), archivo.buffer);
    return { guardado: true, nombre, ruta: path.join(carpeta, nombre) };
  } catch (err) {
    console.error(`[soporte] no se pudo guardar el adjunto en ${carpeta}: ${err.code || err.message}`);
    return { guardado: false, nombre: archivo.originalname };
  }
}

/** Button2_Click de ssoportesist.aspx: guarda, copia el adjunto y avisa a Sistemas. */
export async function crear({ cedula, tipoSoporteId, descripcion }, archivo) {
  const tipo = await repo.tipoPorId(tipoSoporteId);
  if (!tipo) throw badRequest('Tipo de soporte inválido', [{ campo: 'tipoSoporteId', mensaje: 'Seleccione el tipo de soporte' }]);

  const emp = await empleados.findByCedula(cedula);
  if (!emp) throw notFound('Esta cédula no existe en el SPI');
  const usuario = empleados.nombreLegacy(emp);

  const id = await repo.insertar({ departamento: emp.departamento, usuario, tipo: tipo.nombre, descripcion });
  const adjunto = archivo ? await guardarAdjunto(usuario, id, archivo) : null;

  const textoAdjunto = !adjunto ? 'Sin adjunto'
    : adjunto.guardado ? adjunto.ruta : `${adjunto.nombre} (no se pudo copiar a la carpeta compartida)`;
  const correoEnviado = await enviarCorreo({
    para: env.correo.sistemas,
    asunto: tipo.nombre, // igual que hoy: el asunto es el tipo de soporte
    texto: [
      `Número de solicitud: ${id ?? '—'}`,
      `Departamento: ${emp.departamento ?? ''}`,
      `Usuario: ${usuario}`,
      `Cédula: ${emp.cedula}`,
      `Tipo de soporte: ${tipo.nombre}`,
      `Falla: ${descripcion}`,
      `Adjunto: ${textoAdjunto}`,
    ].join('\n'),
  });

  return {
    id,
    numero: id ? String(id).padStart(6, '0') : '—',
    tipo: tipo.nombre,
    estado: 'PENDIENTE',
    creadaEn: new Date().toISOString(),
    solicitante: emp.nombreCompleto,
    correoEnviado,
    adjuntoGuardado: adjunto ? adjunto.guardado : null,
  };
}
