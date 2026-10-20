import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';
import { uploaderImagenes, uploaderPdf } from '../../middlewares/upload.js';
import { invalidate } from '../../utils/cache.js';
import { iniciarSesion } from './admin.sesion.js';
import * as contenido from '../contenido/contenido.repository.js';
import * as eventos from '../eventos/eventos.service.js';
import * as normas from '../documentos/normas.service.js';
import * as tema from '../tema/tema.service.js';
import * as directorio from '../directorio/directorio.repository.js';

/*
 * Panel de administración: /api/admin/...
 * Todo exige sesión (Authorization: Bearer <token>) salvo POST /sesion.
 */
const router = Router();

router.post('/sesion', validate(z.object({
  usuario: z.string({ error: 'Indique el usuario' }).trim().min(1, 'Indique el usuario').max(50),
  clave: z.string({ error: 'Indique la clave' }).min(1, 'Indique la clave').max(100),
})), (req, res) => res.json(iniciarSesion(req.body, req.ip)));

router.use(requireAdmin);
router.get('/sesion', (req, res) => res.json({ usuario: req.admin.u, expira: req.admin.exp ? new Date(req.admin.exp).toISOString() : null }));

/* ---------------------------------- utilidades ---------------------------------- */
const id = z.object({ id: z.coerce.number().int().positive() });
// Los formularios multipart mandan los booleanos como texto
const booleano = z.union([z.boolean(), z.enum(['true', 'false', '1', '0', 'on'])])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 'on');
const borrarArchivos = (files = []) => files.forEach((f) => f?.path && fs.rm(f.path, { force: true }, () => {}));
const limpiarInicio = () => { invalidate('contenido:'); invalidate('comunicados:'); };

/* ----------------------------------- banners ----------------------------------- */
router.get('/banners', asyncHandler(async (_req, res) => res.json(await contenido.todosBanners())));

router.post('/banners', uploaderImagenes('banners').array('imagenes', 20), asyncHandler(async (req, res) => {
  if (!req.files?.length) throw badRequest('Seleccione al menos una imagen');
  try {
    for (const f of req.files) await contenido.crearBanner({ archivo: f.filename, ruta: '/uploads/banners/' });
  } catch (err) {
    borrarArchivos(req.files);
    throw err;
  }
  limpiarInicio();
  res.status(201).json(await contenido.todosBanners());
}));

router.patch('/banners/:id', validate(id, 'params'), validate(z.object({ activo: z.boolean() })), asyncHandler(async (req, res) => {
  if (!(await contenido.estadoBanner(req.params.id, req.body.activo))) throw notFound('El banner no existe');
  limpiarInicio();
  res.json(await contenido.todosBanners());
}));

/* --------------------------------- comunicados --------------------------------- */
router.get('/comunicados', asyncHandler(async (_req, res) => res.json(await contenido.todosComunicados())));

router.post('/comunicados', uploaderImagenes('comunicados').single('imagen'),
  validate(z.object({ reemplazar: booleano.default(true) })), asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Seleccione la imagen del comunicado');
    let row;
    try {
      row = await contenido.crearComunicado({ archivo: req.file.filename, ruta: '/uploads/comunicados/' });
    } catch (err) {
      borrarArchivos([req.file]);
      throw err;
    }
    // "Cambiar el comunicado vigente": el nuevo queda solo
    if (req.body.reemplazar) await contenido.desactivarOtrosComunicados(row.id);
    limpiarInicio();
    res.status(201).json(await contenido.todosComunicados());
  }));

router.patch('/comunicados/:id', validate(id, 'params'), validate(z.object({ activo: z.boolean() })), asyncHandler(async (req, res) => {
  if (!(await contenido.estadoComunicado(req.params.id, req.body.activo))) throw notFound('El comunicado no existe');
  limpiarInicio();
  res.json(await contenido.todosComunicados());
}));

/* ----------------------------------- eventos ----------------------------------- */
const subirEvento = uploaderImagenes('eventos/_tmp').fields([{ name: 'portada', maxCount: 1 }, { name: 'fotos', maxCount: 80 }]);
const archivosEvento = (req) => ({ portada: req.files?.portada?.[0], fotos: req.files?.fotos ?? [] });
// Si la validación falla, los archivos ya subidos a _tmp se borran
const validarEvento = (schema) => (req, res, next) => validate(schema)(req, res, (err) => {
  if (err) { const a = archivosEvento(req); borrarArchivos([a.portada, ...a.fotos]); }
  next(err);
});
const titulo = z.string({ error: 'Indique el nombre del evento' }).trim().min(3, 'Indique el nombre del evento').max(150, 'Máximo 150 caracteres');

router.get('/eventos', asyncHandler(async (_req, res) => res.json(await eventos.listarAdmin())));
router.get('/eventos/:id', validate(id, 'params'), asyncHandler(async (req, res) => res.json(await eventos.detalleAdmin(req.params.id))));

router.post('/eventos', subirEvento, validarEvento(z.object({ titulo, activo: booleano.default(true) })), asyncHandler(async (req, res) => {
  const { portada, fotos } = archivosEvento(req);
  res.status(201).json(await eventos.crear(req.body, portada, fotos));
}));

router.patch('/eventos/:id', validate(id, 'params'), subirEvento,
  validarEvento(z.object({ titulo: titulo.optional(), activo: booleano.optional() })), asyncHandler(async (req, res) => {
    const { portada, fotos } = archivosEvento(req);
    borrarArchivos(fotos); // las fotos se agregan por /fotos
    res.json(await eventos.actualizar(req.params.id, req.body, portada));
  }));

router.post('/eventos/:id/fotos', validate(id, 'params'), subirEvento, asyncHandler(async (req, res) => {
  const { portada, fotos } = archivosEvento(req);
  borrarArchivos([portada]);
  res.json(await eventos.agregarFotos(req.params.id, fotos));
}));

router.delete('/eventos/:id/fotos/:archivo', validate(z.object({ id: z.coerce.number().int().positive(), archivo: z.string().min(1).max(200) }), 'params'),
  (req, res) => res.json(eventos.quitarFoto(req.params.id, req.params.archivo)));

router.delete('/eventos/:id', validate(id, 'params'), asyncHandler(async (req, res) => {
  await eventos.eliminar(req.params.id);
  res.status(204).end();
}));

/* ----------------------------------- normas ----------------------------------- */
router.get('/normas', (_req, res) => res.json(normas.listar()));

router.post('/normas', uploaderPdf().array('archivos', 20), validate(z.object({
  titulo: z.string().trim().max(150, 'Máximo 150 caracteres').optional().transform((v) => v || null),
  reemplazar: booleano.default(false),
})), (req, res) => res.status(201).json(normas.guardar(req.files, req.body)));

router.patch('/normas/:archivo', validate(z.object({
  titulo: z.string({ error: 'Indique el nombre' }).trim().min(2, 'Indique el nombre').max(150, 'Máximo 150 caracteres'),
})), (req, res) => res.json(normas.renombrar(req.params.archivo, req.body.titulo)));

router.delete('/normas/:archivo', (req, res) => res.json(normas.retirar(req.params.archivo)));

/* ---------------------------------- directorio ---------------------------------- */
const texto = (max, msg) => z.string({ error: msg }).trim().min(1, msg).max(max, `Máximo ${max} caracteres`);
const contacto = z.object({
  tipo: z.enum(['extension', 'emergencia', 'proveedor'], { error: 'Seleccione el tipo' }),
  departamento: texto(150, 'Indique el departamento o servicio'),
  nombre: texto(150, 'Indique el nombre'),
  extension: z.string().trim().max(9).optional().default(''),
  telefono: z.string().trim().max(50, 'Máximo 50 caracteres').optional().default(''),
  asterisco: z.string().trim().max(50, 'Máximo 50 caracteres').optional().default(''),
  correo: z.union([z.email('Correo inválido').max(150), z.literal('')]).optional().default(''),
  esPersona: z.boolean().optional().default(true),
}).superRefine((d, ctx) => {
  if (d.tipo === 'extension' && !/^\d{1,9}$/.test(d.extension)) ctx.addIssue({ code: 'custom', path: ['extension'], message: 'La extensión debe ser un número' });
  if (d.tipo !== 'extension' && !d.telefono) ctx.addIssue({ code: 'custom', path: ['telefono'], message: 'Indique el teléfono' });
});
const limpiarDirectorio = () => invalidate('dir:');

router.get('/directorio', asyncHandler(async (_req, res) => res.json(await directorio.todos())));

router.post('/directorio', validate(contacto), asyncHandler(async (req, res) => {
  await directorio.crear(req.body);
  limpiarDirectorio();
  res.status(201).json(await directorio.todos());
}));

router.put('/directorio/:id', validate(id, 'params'), validate(contacto), asyncHandler(async (req, res) => {
  const actual = await directorio.obtener(req.params.id);
  if (!actual) throw notFound('El registro no existe');
  await directorio.actualizar(req.params.id, req.body, actual.usuario);
  limpiarDirectorio();
  res.json(await directorio.todos());
}));

// Extensiones: activar / desactivar. Emergencias y proveedores: eliminar
router.patch('/directorio/:id', validate(id, 'params'), validate(z.object({ activo: z.boolean() })), asyncHandler(async (req, res) => {
  const actual = await directorio.obtener(req.params.id);
  if (!actual) throw notFound('El registro no existe');
  if (![0, 1].includes(actual.estado)) throw badRequest('Solo las extensiones se pueden desactivar');
  await directorio.cambiarEstado(req.params.id, req.body.activo ? 1 : 0);
  limpiarDirectorio();
  res.json(await directorio.todos());
}));

router.delete('/directorio/:id', validate(id, 'params'), asyncHandler(async (req, res) => {
  const actual = await directorio.obtener(req.params.id);
  if (!actual) throw notFound('El registro no existe');
  if (actual.estado === 1) throw badRequest('Las extensiones activas se desactivan, no se eliminan');
  await directorio.eliminar(req.params.id);
  limpiarDirectorio();
  res.json(await directorio.todos());
}));

/* ----------------------------------- empresa ----------------------------------- */
const opcional = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().default('');
router.get('/empresa', asyncHandler(async (_req, res) => res.json(await contenido.empresa())));
router.put('/empresa', validate(z.object({
  nombre: texto(150, 'Indique el nombre de la empresa'),
  rif: texto(20, 'Indique el RIF'),
  telefono: opcional(60),
  fax: opcional(60),
  correo: z.union([z.email('Correo inválido').max(150), z.literal('')]).optional().default(''),
  direccion: opcional(300),
  mapaUrl: z.union([z.url('Enlace inválido').max(600), z.literal('')]).optional().default(''),
  mision: texto(1500, 'Escriba la misión'),
  vision: texto(1500, 'Escriba la visión'),
  valores: z.array(z.string().trim().min(1).max(60, 'Cada valor: máximo 60 caracteres')).min(1, 'Agregue al menos un valor').max(20),
})), (req, res) => {
  const e = contenido.guardarEmpresa(req.body);
  invalidate('contenido:');
  res.json(e);
});

/* ---------------------------------- apariencia ---------------------------------- */
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color inválido (use #RRGGBB)').transform((c) => c.toLowerCase());

router.get('/tema', (_req, res) => res.json({ ...tema.leer(), porDefecto: tema.POR_DEFECTO, fuentes: tema.FUENTES }));
const fuente = z.enum(tema.FUENTES, { error: 'Fuente no disponible' });
router.put('/tema', validate(z.object({ marca: color, accion: color, acento: color, fuenteTitulos: fuente.optional(), fuenteTexto: fuente.optional() })),
  (req, res) => res.json(tema.guardar(req.body, req.admin.u)));
router.delete('/tema', (req, res) => res.json(tema.restablecer(req.admin.u)));

export default router;
