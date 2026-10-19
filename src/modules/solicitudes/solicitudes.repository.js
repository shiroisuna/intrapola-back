import { caa, sql } from '../../config/db.js';

const { query } = caa; // BD CAA

export async function findTipo(codigo, tx) {
  const rows = await query(
    `SELECT id, codigo, nombre, area, formulario FROM dbo.tipos_solicitud WHERE codigo = @codigo AND activo = 1`,
    { codigo: [sql.VarChar(30), codigo] }, tx,
  );
  return rows[0] ?? null;
}

export async function insertCabecera({ tipoId, cedula, departamentoId, descripcion, adjuntoUrl }, tx) {
  const rows = await query(
    `INSERT INTO dbo.solicitudes (tipo_id, cedula, departamento_id, descripcion, adjunto_url)
     OUTPUT inserted.id, inserted.creada_en AS creadaEn, inserted.estado
     VALUES (@tipoId, @cedula, @departamentoId, @descripcion, @adjuntoUrl)`,
    {
      tipoId: [sql.Int, tipoId],
      cedula: [sql.VarChar(15), cedula],
      departamentoId: [sql.Int, departamentoId],
      descripcion: [sql.NVarChar(1000), descripcion],
      adjuntoUrl: [sql.NVarChar(260), adjuntoUrl],
    }, tx,
  );
  return rows[0];
}

export function insertPermiso(id, d, tx) {
  return query(
    `INSERT INTO dbo.solicitud_permiso (solicitud_id, fecha_permiso, tipo_permiso, tiempo, medida, motivo, observaciones)
     VALUES (@id, @fecha, @tipo, @tiempo, @medida, @motivo, @obs)`,
    {
      id: [sql.Int, id],
      fecha: [sql.Date, d.fechaPermiso],
      tipo: [sql.VarChar(15), d.tipoPermiso],
      tiempo: [sql.Decimal(5, 2), d.tiempo],
      medida: [sql.VarChar(5), d.medida],
      motivo: [sql.NVarChar(200), d.motivo],
      obs: [sql.NVarChar(500), d.observaciones],
    }, tx,
  );
}

/** Inserta todos los artículos en una sola sentencia validando la categoría. */
export async function insertItems(id, categoria, items, tx) {
  const json = JSON.stringify(items.map((i) => ({ a: i.articuloId, c: i.cantidad })));
  const rows = await query(
    `INSERT INTO dbo.solicitud_items (solicitud_id, articulo_id, cantidad)
     OUTPUT inserted.articulo_id
     SELECT @id, j.a, j.c
     FROM OPENJSON(@json) WITH (a INT '$.a', c SMALLINT '$.c') j
     JOIN dbo.articulos ar ON ar.id = j.a AND ar.categoria = @categoria AND ar.activo = 1`,
    { id: [sql.Int, id], json: [sql.NVarChar(sql.MAX), json], categoria: [sql.VarChar(12), categoria] }, tx,
  );
  return rows.length;
}

export async function findTipoSoporteId(nombre, tx) {
  const rows = await query(`SELECT id FROM dbo.tipos_soporte WHERE nombre = @n`, { n: [sql.NVarChar(80), nombre] }, tx);
  return rows[0]?.id ?? null;
}

export function insertSoporte(id, tipoSoporteId, motivo, tx) {
  return query(
    `INSERT INTO dbo.solicitud_soporte (solicitud_id, tipo_soporte_id, motivo) VALUES (@id, @tipo, @motivo)`,
    { id: [sql.Int, id], tipo: [sql.Int, tipoSoporteId], motivo: [sql.NVarChar(150), motivo] }, tx,
  );
}

export async function insertUsuario(id, d, tx) {
  await query(
    `INSERT INTO dbo.solicitud_usuario (solicitud_id, accion, nombre_usuario, cargo_usuario, recursos_especiales)
     VALUES (@id, @accion, @nombre, @cargo, @recursos)`,
    {
      id: [sql.Int, id],
      accion: [sql.VarChar(12), d.accion],
      nombre: [sql.NVarChar(120), d.nombreUsuario],
      cargo: [sql.NVarChar(100), d.cargoUsuario],
      recursos: [sql.NVarChar(500), d.recursosEspeciales],
    }, tx,
  );
  if (d.accesos.length) {
    await query(
      `INSERT INTO dbo.solicitud_usuario_accesos (solicitud_id, acceso_id)
       SELECT DISTINCT @id, a.id FROM OPENJSON(@json) WITH (v INT '$') j
       JOIN dbo.accesos a ON a.id = j.v AND a.activo = 1`,
      { id: [sql.Int, id], json: [sql.NVarChar(sql.MAX), JSON.stringify(d.accesos)] }, tx,
    );
  }
}

export function list({ cedula, area, estado, limite }) {
  return query(
    `SELECT TOP (@limite) id, tipo_codigo AS tipoCodigo, tipo, area, cedula, solicitante, departamento,
            descripcion, estado, creada_en AS creadaEn
     FROM dbo.vw_solicitudes
     WHERE (@cedula IS NULL OR cedula = @cedula)
       AND (@area   IS NULL OR area   = @area)
       AND (@estado IS NULL OR estado = @estado)
     ORDER BY creada_en DESC`,
    {
      limite: [sql.Int, limite],
      cedula: [sql.VarChar(15), cedula ?? null],
      area: [sql.VarChar(12), area ?? null],
      estado: [sql.VarChar(12), estado ?? null],
    },
  );
}

export async function findById(id) {
  const [cab] = await query(
    `SELECT id, tipo_codigo AS tipoCodigo, tipo, area, cedula, solicitante, departamento, descripcion,
            adjunto_url AS adjuntoUrl, estado, respuesta, creada_en AS creadaEn, actualizada_en AS actualizadaEn
     FROM dbo.vw_solicitudes WHERE id = @id`,
    { id: [sql.Int, id] },
  );
  if (!cab) return null;

  const p = { id: [sql.Int, id] };
  const [permiso] = await query(
    `SELECT fecha_permiso AS fechaPermiso, tipo_permiso AS tipoPermiso, tiempo, medida, motivo, observaciones
     FROM dbo.solicitud_permiso WHERE solicitud_id = @id`, p);
  const items = await query(
    `SELECT a.id AS articuloId, a.nombre, a.unidad, i.cantidad
     FROM dbo.solicitud_items i JOIN dbo.articulos a ON a.id = i.articulo_id WHERE i.solicitud_id = @id`, p);
  const [soporte] = await query(
    `SELECT t.nombre AS tipoSoporte, s.motivo FROM dbo.solicitud_soporte s
     JOIN dbo.tipos_soporte t ON t.id = s.tipo_soporte_id WHERE s.solicitud_id = @id`, p);
  const [usuario] = await query(
    `SELECT accion, nombre_usuario AS nombreUsuario, cargo_usuario AS cargoUsuario, recursos_especiales AS recursosEspeciales
     FROM dbo.solicitud_usuario WHERE solicitud_id = @id`, p);
  if (usuario) {
    usuario.accesos = (await query(
      `SELECT a.nombre FROM dbo.solicitud_usuario_accesos x JOIN dbo.accesos a ON a.id = x.acceso_id
       WHERE x.solicitud_id = @id ORDER BY a.orden`, p)).map((r) => r.nombre);
  }

  return { ...cab, permiso: permiso ?? null, items, soporte: soporte ?? null, usuario: usuario ?? null };
}

export async function updateEstado(id, estado, respuesta) {
  const rows = await query(
    `UPDATE dbo.solicitudes SET estado = @estado, respuesta = COALESCE(@respuesta, respuesta),
            actualizada_en = SYSDATETIME()
     OUTPUT inserted.id, inserted.estado
     WHERE id = @id`,
    { id: [sql.Int, id], estado: [sql.VarChar(12), estado], respuesta: [sql.NVarChar(1000), respuesta] },
  );
  return rows[0] ?? null;
}
