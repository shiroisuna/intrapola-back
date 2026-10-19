import fs from 'node:fs';
import path from 'node:path';
import oracledb from 'oracledb';
import { env } from './env.js';

/*
 * Conexión al SPI (Oracle) — nómina: empleados, departamentos, cargos.
 * Por defecto usa el modo "Thin" (no requiere instalar nada). Si el servidor Oracle es
 * anterior a 12.1 y aparece el error NJS-138, instalar Oracle Instant Client y definir
 * ORACLE_CLIENT_DIR en el .env para activar el modo "Thick".
 */
/* Modo Thick (Instant Client). Si falla, se avisa claramente en la consola en vez de seguir en Thin sin decir nada. */
let modo = 'Thin';
if (env.spi.clientDir) {
  const dll = path.join(env.spi.clientDir, process.platform === 'win32' ? 'oci.dll' : 'libclntsh.so');
  if (!fs.existsSync(dll)) {
    console.error(`[db] spi: no se encontró ${dll}. Revise ORACLE_CLIENT_DIR o si el antivirus puso en cuarentena el Instant Client.`);
  }
  try {
    oracledb.initOracleClient({ libDir: env.spi.clientDir });
    modo = `Thick (Instant Client ${oracledb.oracleClientVersionString})`;
  } catch (err) {
    console.error(`[db] spi: no se pudo cargar Oracle Instant Client desde ${env.spi.clientDir}: ${err.message}`);
  }
}
console.log(`[db] spi: modo ${modo}${modo === 'Thin' && env.spi.clientDir ? ' — el SPI (Oracle 11g) NO va a funcionar así' : ''}`);
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.NUMBER, oracledb.DATE]; // cédulas y fechas como texto, sin sorpresas de tipos

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = oracledb
      .createPool({
        user: env.spi.user,
        password: env.spi.password,
        connectString: env.spi.connectString,
        poolMin: 0,
        poolMax: 4,
        poolTimeout: 60,
      })
      .then((pool) => {
        console.log(`[db] spi: listo para conectar a ${env.spi.connectString}`);
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error(`[db] spi: ${err.message}`);
        throw err;
      });
  }
  return poolPromise;
}

/**
 * Consulta con parámetros enlazados (nunca concatenar valores en el SQL).
 *   spi.query('SELECT ... WHERE cedula = :cedula', { cedula: '12345678' })
 * Devuelve las filas como objetos con los nombres de columna en MAYÚSCULAS (convención de Oracle).
 */
async function query(sql, binds = {}) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds);
    return result.rows ?? [];
  } finally {
    await conn.close();
  }
}

async function close() {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    await pool?.close(5);
  }
  poolPromise = null;
}

export const spi = { nombre: 'spi', query, close };
