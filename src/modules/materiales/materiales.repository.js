import { caa, sql } from '../../config/db.js';

/* CAA.intrapola_cme_material — mismo INSERT que Button2_Click de crmddemat_sap.aspx */
export async function crear(m) {
  const t = (n) => [sql.NVarChar(n)];
  const [f] = await caa.query(
    `INSERT INTO dbo.intrapola_cme_material
       (cedula_mat, nombre_mat, dept_mat, motivo_mat, observcmd_mat, solicitud_mat, autoriza_mat, exite_mat, codexiste_mat,
        fechasol_mat, materianvo_mat, almacen_mat, um_mat, grcompras_mat, grpart_mat, ptopedido_mat, max_mat, stockseg_mat, estado_mat)
     OUTPUT INSERTED.id_mat AS id
     VALUES (@cedula, @nombre, @dpto, @motivo, @observaciones, @solicitud, @autoriza, @existe, @codigo,
             @fecha, @material, @almacen, @um, @grCompras, @grArt, @ptoPedido, @max, @stockSeg, '0')`,
    {
      cedula: [...t(20), m.cedula],
      nombre: [...t(150), m.nombre],
      dpto: [...t(150), m.departamento],
      motivo: [...t(500), m.motivo],
      observaciones: [...t(1000), m.observaciones],
      solicitud: [...t(30), m.solicitud],
      autoriza: [...t(150), m.autoriza],
      existe: [...t(30), m.existe],
      codigo: [...t(50), m.codigo ?? ''],
      fecha: [...t(10), m.fecha], // yyyy-mm-dd, como el TextBox de fecha del C#
      material: [...t(300), m.material],
      almacen: [...t(100), m.almacen],
      um: [...t(20), m.um],
      grCompras: [...t(50), m.grCompras ?? ''],
      grArt: [...t(50), m.grArt ?? ''],
      ptoPedido: [...t(30), m.ptoPedido ?? ''],
      max: [...t(30), m.max ?? ''],
      stockSeg: [...t(30), m.stockSeg ?? ''],
    },
  );
  return f.id;
}

export function historial(cedula, limite) {
  return caa.query(
    `SELECT TOP (@limite) id_mat AS id, RTRIM(solicitud_mat) AS solicitud, RTRIM(materianvo_mat) AS material,
            RTRIM(codexiste_mat) AS codigo, CONVERT(VARCHAR(10), fechasol_mat, 23) AS fecha, RTRIM(CONVERT(VARCHAR(10), estado_mat)) AS estado
     FROM dbo.intrapola_cme_material WHERE RTRIM(cedula_mat) = @cedula ORDER BY id_mat DESC`,
    { limite: [sql.Int, limite], cedula: [sql.NVarChar(20), cedula] },
  );
}
