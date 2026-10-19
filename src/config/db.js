import sql from 'mssql';
import { env } from './env.js';
import { spi } from './oracle.js';

/**
 * Una conexión (pool) por base de datos. Uso en los repositorios:
 *
 *   import { caa, sql } from '../../config/db.js';
 *   const filas = await caa.query('SELECT ... WHERE id = @id', { id: [sql.Int, 5] });
 *
 * Bases disponibles: amapolanet, caa (ver env.databases).
 */
/**
 * ¿Es un parámetro con tipo explícito [sql.Tipo, valor]?
 * sql.Int es una función; sql.NVarChar(150) devuelve un objeto { type, length }.
 */
const esTipoSql = (t) => typeof t === 'function' || (t !== null && typeof t === 'object' && typeof t.type === 'function');
const esTipado = (v) => Array.isArray(v) && v.length === 2 && esTipoSql(v[0]);

function crearBase(nombre) {
  const config = env.databases[nombre];
  let poolPromise = null;

  function getPool() {
    if (!poolPromise) {
      poolPromise = new sql.ConnectionPool(config)
        .connect()
        .then((pool) => {
          const inst = config.options.instanceName ? `\\${config.options.instanceName}` : '';
          console.log(`[db] ${nombre}: conectado a ${config.server}${inst}/${config.database}`);
          return pool;
        })
        .catch((err) => {
          poolPromise = null; // permite reintentar en la próxima petición
          console.error(`[db] ${nombre}: ${err.message}`);
          throw err;
        });
    }
    return poolPromise;
  }

  /**
   * Consulta parametrizada.
   * params: { nombre: valor } o { nombre: [sql.Tipo, valor] }
   * tx: transacción opcional (de withTransaction de ESTA misma base)
   */
  async function query(text, params = {}, tx) {
    const request = tx ? new sql.Request(tx) : (await getPool()).request();
    for (const [name, value] of Object.entries(params)) {
      if (esTipado(value)) {
        request.input(name, value[0], value[1]);
      } else {
        request.input(name, value ?? null);
      }
    }
    const result = await request.query(text);
    return result.recordset ?? [];
  }

  /** Ejecuta fn(tx) en una transacción; rollback si algo falla. */
  async function withTransaction(fn) {
    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    try {
      const out = await fn(tx);
      await tx.commit();
      return out;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async function close() {
    if (poolPromise) (await poolPromise.catch(() => null))?.close();
    poolPromise = null;
  }

  return { nombre, getPool, query, withTransaction, close };
}

export const amapolanet = crearBase('amapolanet');
export const caa = crearBase('caa');
// Asistencia-Amapola (reloj de asistencia): fecha de ingreso para la regla del anticipo
export const asistencia = crearBase('asistencia');

export const bases = { amapolanet, caa, asistencia, spi };

export async function closePools() {
  await Promise.all(Object.values(bases).map((b) => b.close()));
}

export { sql, spi };
