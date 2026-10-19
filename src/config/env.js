import 'dotenv/config';

const required = ['DB_SERVER', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`[env] Faltan variables: ${missing.join(', ')}. Revise el archivo .env`);
}

/**
 * Acepta DB_SERVER como "servidor\instancia" (igual que el SGD) o servidor + DB_INSTANCE.
 * Con instancia el puerto lo resuelve SQL Browser, así que no se envía port.
 */
function parseServidor() {
  const [server, instanciaEnServer] = (process.env.DB_SERVER || '').split('\\');
  const instanceName = process.env.DB_INSTANCE || instanciaEnServer || undefined;
  return {
    server,
    ...(instanceName ? {} : { port: Number(process.env.DB_PORT || 1433) }),
    instanceName,
  };
}

const { server, port, instanceName } = parseServidor();

/** Configuración base compartida; cada base de datos solo cambia `database`. */
const base = {
  server,
  ...(port && { port }),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 15000,
  requestTimeout: 30000,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    instanceName,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

export const env = {
  port: Number(process.env.PORT || 5200),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 10),
  // Servidor IIS de la Intrapola actual: de ahí se sirven las imágenes guardadas con ruta "/intrapola/imagenes/"
  legacyBaseUrl: (process.env.LEGACY_BASE_URL || 'http://192.168.10.112').replace(/\/$/, ''),
  // Carpeta de la aplicación ASP.NET: las rutas "~/..." se resuelven contra ella
  legacyAppPath: `/${(process.env.LEGACY_APP_PATH || 'intrapola').replace(/^\/|\/$/g, '')}`,
  // SPI (Oracle): nómina
  spi: {
    user: process.env.SPI_USER,
    password: process.env.SPI_PASSWORD,
    connectString: process.env.SPI_CONNECT || '192.168.10.141/SPI',
    clientDir: process.env.ORACLE_CLIENT_DIR || null,
  },
  // Correo: mismo conector de Office 365 que usa la Intrapola actual (autoriza por IP, sin usuario)
  correo: {
    host: process.env.SMTP_HOST || 'industriasamapola-com.mail.protection.outlook.com',
    port: Number(process.env.SMTP_PORT || 25),
    from: process.env.SMTP_FROM || null, // en el C# es AppSettings["SmtpUser"]
    rrhh: process.env.CORREO_RRHH || 'satrrhh@industriasamapola.com',
    sistemas: process.env.CORREO_SISTEMAS || 'sistemas.amapola@industriasamapola.com',
    anticipos: (process.env.CORREO_ANTICIPOS || 'yromero@industriasamapola.com,cramirez@industriasamapola.com')
      .split(',').map((s) => s.trim()).filter(Boolean),
  },
  // Carpeta compartida donde Sistemas recibe los adjuntos de soporte (una subcarpeta por usuario)
  soporte: {
    adjuntos: process.env.SOPORTE_ADJUNTOS || '\\\\192.168.10.123\\tudirectorioenelservidor',
  },
  // Anticipo de prestaciones
  anticipos: {
    // Carpeta de RRHH con las planillas mensuales. {anio} y {mes} se reemplazan (mes en español: "octubre").
    carpeta: process.env.ANTICIPOS_CARPETA
      || '\\\\192.168.10.106\\gr_rrhh$\\Nóminas\\Nominas Año {anio}\\Abonos de Prestaciones Sociales\\{mes}',
    // Firma de las sesiones del portal. Si no se define, se genera al arrancar (las sesiones se pierden al reiniciar).
    secreto: process.env.ANTICIPOS_SECRETO || null,
  },
  databases: {
    // usuarios, extensiones, eventos, papelería, relación de gastos
    amapolanet: { ...base, database: process.env.DB_AMAPOLANET || 'amapolanet' },
    // solicitudes, formatos y lo demás
    caa: { ...base, database: process.env.DB_CAA || 'CAA' },
    // reloj de asistencia (USERINFO): solo lectura, para la regla trimestral del anticipo
    asistencia: { ...base, database: process.env.DB_ASISTENCIA || 'Asistencia-Amapola' },
  },
};
