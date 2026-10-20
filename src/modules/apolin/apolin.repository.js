import { asistencia, caa, sql } from '../../config/db.js';
import { DEPARTAMENTOS, OPCIONES_SOPORTE } from './apolin.constantes.js';

/*
 * Tablas que usa Apolin (las mismas del chatbot en Python):
 *   Asistencia-Amapola.USERINFO       (Badgenumber = ficha, CardNo = cédula, Name, lastname, DEFAULTDEPTID, BIRTHDAY)
 *   CAA.intrapola_ssoporte_sist       tickets de soporte (se crean con el módulo de soporte de la intranet)
 *   CAA.sat_encuesta_sistemas         encuestas de satisfacción (nrosol_id = id_st del ticket)
 *   CAA.intrapola_prestamos_equipos   (id_prestamo, ficha_usuario, nombre_usuario, departamento, equipo,
 *                                      fecha_prestamo, fecha_devolucion, estado, notificado)
 *   CAA.intrapola_recordatorios_apolin (id, titulo, mensaje, tipo, fecha_inicio, fecha_fin, imagen, imagen_tipo,
 *                                       activo, created_by, fecha_registro)
 */

/** Trabajador en el reloj de asistencia por ficha (buscar_empleado del chatbot). */
export async function buscarEnReloj(ficha) {
  const [f] = await asistencia.query(
    `SELECT TOP 1 LTRIM(RTRIM(Name)) AS nombre, LTRIM(RTRIM(lastname)) AS apellido,
            NULLIF(LTRIM(RTRIM(CardNo)), '') AS cedula, DEFAULTDEPTID AS deptoId,
            CASE WHEN MONTH(BIRTHDAY) = MONTH(GETDATE()) AND DAY(BIRTHDAY) = DAY(GETDATE()) THEN 1 ELSE 0 END AS cumpleHoy
     FROM dbo.USERINFO WHERE RTRIM(Badgenumber) = @ficha`,
    { ficha: [sql.NVarChar(30), String(ficha)] },
  );
  if (!f) return null;
  return {
    nombreCompleto: [f.nombre, f.apellido].filter(Boolean).join(' '),
    cedula: f.cedula,
    departamento: DEPARTAMENTOS[f.deptoId] ?? 'General',
    cumpleHoy: f.cumpleHoy === 1,
  };
}

/** Tipos de soporte activos (los mismos del formulario web); si falla, la lista del chatbot. */
export async function tiposSoporte() {
  try {
    const filas = await caa.query(`SELECT LTRIM(RTRIM(tipost)) AS nombre FROM dbo.tipo_soporte WHERE estadost = 1 ORDER BY LTRIM(RTRIM(tipost))`);
    return filas.length ? filas.map((f) => f.nombre) : OPCIONES_SOPORTE;
  } catch {
    return OPCIONES_SOPORTE;
  }
}

/**
 * Tickets ya procesados sin encuesta de satisfacción (obtener_tickets_soporte_sin_encuesta_por_nombre).
 * usuario_st puede venir como "NOMBRE-APELLIDO" (formulario web) o "Nombre Apellido" (chatbot anterior).
 */
export async function ticketsSinEncuesta(nombres) {
  const lista = [...new Set(nombres.filter(Boolean).map((n) => n.trim().toUpperCase()))];
  if (!lista.length) return [];
  const params = Object.fromEntries(lista.map((n, i) => [`n${i}`, [sql.NVarChar(150), n]]));
  return caa.query(
    `SELECT s.id_st AS id, LTRIM(RTRIM(s.tipo_st)) AS tipo, CONVERT(VARCHAR(10), s.fecha_st, 103) AS fecha
     FROM dbo.intrapola_ssoporte_sist s
     WHERE UPPER(RTRIM(s.usuario_st)) IN (${lista.map((_, i) => `@n${i}`).join(', ')})
       AND UPPER(RTRIM(s.estado_st)) = 'PROCESADO'
       AND NOT EXISTS (SELECT 1 FROM dbo.sat_encuesta_sistemas e WHERE RTRIM(e.nrosol_id) = CAST(s.id_st AS VARCHAR(20)))
     ORDER BY s.id_st DESC`,
    params,
  );
}

/* ------------------------------- Préstamos ------------------------------- */
export function prestamosVencidos(ficha) {
  return caa.query(
    `SELECT id_prestamo AS id, LTRIM(RTRIM(equipo)) AS equipo, CONVERT(VARCHAR(10), fecha_devolucion, 103) AS devolucion
     FROM dbo.intrapola_prestamos_equipos
     WHERE RTRIM(ficha_usuario) = @ficha AND RTRIM(estado) = 'Pendiente' AND fecha_devolucion < CAST(GETDATE() AS DATE)`,
    { ficha: [sql.NVarChar(30), String(ficha)] },
  );
}

/** Préstamos del mismo equipo en esa fecha (para avisar si ya está apartado). */
export async function equipoOcupado(equipo, fecha) {
  const [f] = await caa.query(
    `SELECT COUNT(*) AS n FROM dbo.intrapola_prestamos_equipos
     WHERE RTRIM(equipo) = @equipo AND RTRIM(estado) = 'Pendiente' AND fecha_prestamo = @fecha`,
    { equipo: [sql.NVarChar(100), equipo], fecha: [sql.Date, fecha] },
  );
  return f.n > 0;
}

export async function crearPrestamo({ ficha, nombre, departamento, equipo, fechaPrestamo, fechaDevolucion }) {
  const [f] = await caa.query(
    `INSERT INTO dbo.intrapola_prestamos_equipos
       (ficha_usuario, nombre_usuario, departamento, equipo, fecha_prestamo, fecha_devolucion, estado, notificado)
     VALUES (@ficha, @nombre, @depto, @equipo, @desde, @hasta, 'Pendiente', 0);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`,
    {
      ficha: [sql.NVarChar(30), String(ficha)],
      nombre: [sql.NVarChar(150), nombre],
      depto: [sql.NVarChar(150), departamento],
      equipo: [sql.NVarChar(100), equipo],
      desde: [sql.Date, fechaPrestamo],
      hasta: [sql.Date, fechaDevolucion],
    },
  );
  return f?.id ?? null;
}

/** verificar_y_notificar_prestamos_vencidos: marca los vencidos como notificados y los devuelve. */
export function marcarVencidosNotificados() {
  return caa.query(
    `UPDATE dbo.intrapola_prestamos_equipos SET notificado = 1
     OUTPUT inserted.id_prestamo AS id, RTRIM(inserted.nombre_usuario) AS nombre, RTRIM(inserted.equipo) AS equipo,
            CONVERT(VARCHAR(10), inserted.fecha_devolucion, 103) AS devolucion
     WHERE RTRIM(estado) = 'Pendiente' AND fecha_devolucion < CAST(GETDATE() AS DATE) AND notificado = 0`,
  );
}

/** Préstamos para el panel: pendientes primero. */
export function prestamos(limite = 200) {
  return caa.query(
    `SELECT TOP (@limite) id_prestamo AS id, RTRIM(ficha_usuario) AS ficha, RTRIM(nombre_usuario) AS nombre,
            RTRIM(departamento) AS departamento, RTRIM(equipo) AS equipo,
            CONVERT(VARCHAR(10), fecha_prestamo, 23) AS fechaPrestamo, CONVERT(VARCHAR(10), fecha_devolucion, 23) AS fechaDevolucion,
            RTRIM(estado) AS estado,
            CASE WHEN RTRIM(estado) = 'Pendiente' AND fecha_devolucion < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS vencido
     FROM dbo.intrapola_prestamos_equipos
     ORDER BY CASE WHEN RTRIM(estado) = 'Pendiente' THEN 0 ELSE 1 END, fecha_prestamo DESC`,
    { limite: [sql.Int, limite] },
  );
}

export const cambiarEstadoPrestamo = (id, estado) => caa.query(
  `UPDATE dbo.intrapola_prestamos_equipos SET estado = @estado OUTPUT inserted.id_prestamo AS id WHERE id_prestamo = @id`,
  { id: [sql.Int, id], estado: [sql.NVarChar(30), estado] },
);

/* ------------------------------ Recordatorios ------------------------------ */
const COLS_REC = `id, titulo, mensaje, tipo, CONVERT(VARCHAR(10), fecha_inicio, 23) AS fechaInicio,
                  CONVERT(VARCHAR(10), fecha_fin, 23) AS fechaFin, CAST(CASE WHEN imagen IS NULL THEN 0 ELSE 1 END AS BIT) AS tieneImagen,
                  activo, created_by AS creadoPor`;

/** Recordatorios vigentes hoy (verificar_recordatorios). */
export const recordatoriosDeHoy = () => caa.query(
  `SELECT ${COLS_REC} FROM dbo.intrapola_recordatorios_apolin
   WHERE activo = 1 AND CAST(GETDATE() AS DATE) BETWEEN CAST(fecha_inicio AS DATE) AND CAST(fecha_fin AS DATE)
   ORDER BY fecha_inicio DESC`,
);

export const recordatoriosActivos = () => caa.query(
  `SELECT ${COLS_REC} FROM dbo.intrapola_recordatorios_apolin WHERE activo = 1 ORDER BY fecha_inicio DESC`,
);

export async function imagenRecordatorio(id) {
  const [f] = await caa.query(
    `SELECT imagen, imagen_tipo AS tipo FROM dbo.intrapola_recordatorios_apolin WHERE id = @id AND imagen IS NOT NULL`,
    { id: [sql.Int, id] },
  );
  return f ?? null;
}

export async function crearRecordatorio({ titulo, mensaje, tipo, fechaInicio, fechaFin, imagen, imagenTipo, creadoPor }) {
  const [f] = await caa.query(
    `INSERT INTO dbo.intrapola_recordatorios_apolin
       (titulo, mensaje, tipo, fecha_inicio, fecha_fin, imagen, imagen_tipo, created_by, activo, fecha_registro)
     VALUES (@titulo, @mensaje, @tipo, @inicio, @fin, @imagen, @imagenTipo, @creadoPor, 1, GETDATE());
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`,
    {
      titulo: [sql.NVarChar(200), titulo],
      mensaje: [sql.NVarChar(sql.MAX), mensaje],
      tipo: [sql.NVarChar(50), tipo],
      inicio: [sql.Date, fechaInicio],
      fin: [sql.Date, fechaFin],
      imagen: [sql.VarBinary(sql.MAX), imagen ?? null],
      imagenTipo: [sql.NVarChar(100), imagenTipo ?? null],
      creadoPor: [sql.NVarChar(100), creadoPor],
    },
  );
  return f?.id ?? null;
}

export const desactivarRecordatorio = (id) => caa.query(
  `UPDATE dbo.intrapola_recordatorios_apolin SET activo = 0 OUTPUT inserted.id WHERE id = @id`,
  { id: [sql.Int, id] },
);
