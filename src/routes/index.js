import { Router } from 'express';
import { bases } from '../config/db.js';
import empleados from '../modules/empleados/empleados.routes.js';
import permisos from '../modules/permisos/permisos.routes.js';
import papeleria from '../modules/papeleria/papeleria.routes.js';
import rrhh from '../modules/rrhh/rrhh.routes.js';
import vacaciones from '../modules/vacaciones/vacaciones.routes.js';
import anticipos from '../modules/anticipos/anticipos.routes.js';
import soporte from '../modules/soporte/soporte.routes.js';
import usuarios from '../modules/usuarios/usuarios.routes.js';
import solicitudes from '../modules/solicitudes/solicitudes.routes.js';
import catalogos from '../modules/catalogos/catalogos.routes.js';
import directorio from '../modules/directorio/directorio.routes.js';
import cumpleanos from '../modules/cumpleanos/cumpleanos.routes.js';
import documentos from '../modules/documentos/documentos.routes.js';
import eventos from '../modules/eventos/eventos.routes.js';
import precios from '../modules/precios/precios.routes.js';
import contenido from '../modules/contenido/contenido.routes.js';

const router = Router();

/** Estado de la API y de cada base de datos: GET /api/salud */
router.get('/salud', async (_req, res) => {
  const estado = { api: 'ok' };
  await Promise.all(Object.values(bases).map(async (b) => {
    try {
      await b.query(b.nombre === 'spi' ? 'SELECT 1 AS OK FROM DUAL' : 'SELECT 1 AS ok');
      estado[b.nombre] = 'ok';
    } catch (err) {
      estado[b.nombre] = `sin conexión: ${err.message}`;
    }
  }));
  const todoOk = Object.values(estado).every((v) => v === 'ok');
  res.status(todoOk ? 200 : 503).json(estado);
});

router.use('/empleados', empleados);
router.use('/solicitudes/permisos', permisos); // antes de /solicitudes
router.use('/solicitudes/papeleria', papeleria);
router.use('/solicitudes/rrhh', rrhh);
router.use('/solicitudes/vacaciones', vacaciones);
router.use('/solicitudes/anticipos', anticipos);
router.use('/solicitudes/soporte', soporte);
router.use('/solicitudes/usuarios', usuarios);
router.use('/solicitudes', solicitudes);
router.use('/catalogos', catalogos);
router.use('/directorio', directorio);
router.use('/cumpleanos', cumpleanos);
router.use('/documentos', documentos);
router.use('/eventos', eventos);
router.use('/precios', precios);
router.use('/contenido', contenido);

export default router;
