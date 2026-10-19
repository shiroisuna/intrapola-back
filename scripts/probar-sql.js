/**
 * Diagnóstico de conexión a SQL Server. Uso (en la carpeta backend):
 *
 *   node scripts/probar-sql.js
 *
 * Muestra QUÉ credenciales está usando realmente el backend (sin mostrar la clave),
 * si alguna variable de Windows está tapando el .env y prueba el login en cada base.
 */
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import dotenv from 'dotenv';

const archivo = path.resolve(process.cwd(), '.env');
const delSistema = {};
for (const k of ['DB_SERVER', 'DB_INSTANCE', 'DB_PORT', 'DB_USER', 'DB_PASSWORD']) {
  if (process.env[k] !== undefined) delSistema[k] = process.env[k];
}

console.log(`\nCarpeta actual: ${process.cwd()}`);
if (!fs.existsSync(archivo)) {
  console.log(`!! No existe ${archivo}. Ejecute el script desde la carpeta backend.`);
  process.exit(1);
}
const crudo = fs.readFileSync(archivo, 'utf8');
const delArchivo = dotenv.parse(crudo);

for (const k of Object.keys(delSistema)) {
  console.log(`!! ${k} está definida en Windows/PM2 y TAPA al .env (dotenv no la reemplaza).`);
}

const lineaClave = crudo.split(/\r?\n/).find((l) => /^\s*DB_PASSWORD\s*=/.test(l)) ?? '';
const clave = delSistema.DB_PASSWORD ?? delArchivo.DB_PASSWORD ?? '';
const usuario = delSistema.DB_USER ?? delArchivo.DB_USER ?? '';
const servidor = delSistema.DB_SERVER ?? delArchivo.DB_SERVER ?? '';

console.log(`Servidor : ${servidor}`);
console.log(`Usuario  : "${usuario}" (${usuario.length} caracteres)`);
console.log(`Clave    : ${clave.length} caracteres, empieza con "${clave[0] ?? ''}", termina con "${clave.at(-1) ?? ''}"`);
if (/#/.test(lineaClave) && !/["']/.test(lineaClave)) {
  console.log('!! La línea DB_PASSWORD tiene "#" sin comillas: dotenv corta la clave ahí. Póngala entre comillas: DB_PASSWORD="..."');
}
if (/\s$/.test(lineaClave.replace(/\r$/, ''))) console.log('!! La línea DB_PASSWORD termina en espacio.');
if (/^﻿/.test(crudo)) console.log('(el .env tiene BOM; normalmente no afecta)');
if (delArchivo.DB_PORT && servidor.includes('\\')) {
  console.log('(DB_PORT se ignora porque DB_SERVER trae instancia; el puerto lo da SQL Browser)');
}

const host = servidor.split('\\')[0];
try {
  const ips = await dns.lookup(host, { all: true });
  console.log(`${host} → ${ips.map((i) => i.address).join(', ')}`);
} catch (e) {
  console.log(`!! No se pudo resolver ${host}: ${e.code}`);
}

// Ahora sí, cargar la configuración igual que el backend
dotenv.config({ quiet: true });
const { env } = await import('../src/config/env.js');
const sql = (await import('mssql')).default;

for (const nombre of ['amapolanet', 'caa', 'asistencia']) {
  const cfg = env.databases[nombre];
  try {
    const pool = await new sql.ConnectionPool(cfg).connect();
    const [r] = (await pool.request().query('SELECT @@SERVERNAME AS srv, SUSER_SNAME() AS login')).recordset;
    console.log(`OK  ${nombre}: conectado a ${r.srv} como ${r.login}`);
    await pool.close();
  } catch (e) {
    const o = e.originalError ?? e;
    console.log(`ERR ${nombre}: [${e.code ?? ''}] ${o.message}`);
  }
}
process.exit(0);
