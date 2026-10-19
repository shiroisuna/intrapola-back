import { z } from 'zod';

const cedula = z.string().trim().regex(/^\d{5,10}$/, 'Cédula inválida');
const texto = (max, msg) => z.string().trim().min(1, msg).max(max, `Máximo ${max} caracteres`);
const opcional = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().transform((v) => v || null);

const items = z
  .array(z.object({
    articuloId: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().min(1, 'La cantidad mínima es 1').max(999),
  }))
  .min(1, 'Agregue al menos un artículo')
  .refine((arr) => new Set(arr.map((i) => i.articuloId)).size === arr.length, 'Hay artículos repetidos');

export const permisoSchema = z.object({
  cedula,
  fechaPermiso: z.coerce.date({ error: 'Fecha del permiso inválida' }),
  tipoPermiso: z.enum(['REMUNERADO', 'NO_REMUNERADO', 'COMPENSATORIO']),
  tiempo: z.coerce.number().positive('Indique el tiempo').max(999),
  medida: z.enum(['HORAS', 'DIAS']),
  motivo: texto(200, 'Indique el motivo del permiso'),
  observaciones: opcional(500),
});

export const rrhhSchema = z.object({
  cedula,
  tipoCodigo: z.string().regex(/^RRHH_[A-Z]+$/, 'Tipo de solicitud inválido'),
  descripcion: texto(500, 'Escriba su solicitud'),
});

export const itemsSchema = z.object({ cedula, items, observaciones: opcional(300) });

export const desarrolloSchema = z.object({
  cedula,
  motivo: texto(150, 'Indique el motivo'),
  descripcion: texto(1000, 'Describa la necesidad'),
});

export const soporteSchema = z.object({
  cedula,
  tipoSoporteId: z.coerce.number().int().positive('Seleccione el tipo de soporte'),
  descripcion: texto(1000, 'Describa la falla'),
});

export const usuarioSchema = z.object({
  cedula,
  accion: z.enum(['AGREGAR', 'MODIFICAR', 'ELIMINAR']),
  nombreUsuario: texto(120, 'Indique el nombre del usuario'),
  cargoUsuario: opcional(100),
  accesos: z.array(z.coerce.number().int().positive()).default([]),
  recursosEspeciales: opcional(500),
}).refine((d) => d.accion === 'ELIMINAR' || d.accesos.length > 0, {
  message: 'Seleccione al menos un acceso', path: ['accesos'],
});

export const listarSchema = z.object({
  cedula,
  limite: z.coerce.number().int().min(1).max(100).default(30),
});

export const estadoSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PROCESO', 'APROBADA', 'RECHAZADA', 'CERRADA']),
  respuesta: opcional(1000),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });
