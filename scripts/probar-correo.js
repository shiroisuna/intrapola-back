/**
 * Prueba de envío de correo con la conversación SMTP completa. Uso (en la carpeta backend):
 *
 *   node scripts/probar-correo.js destinatario@industriasamapola.com
 */
process.env.SMTP_DEBUG = 'true';
const { env } = await import('../src/config/env.js');
const { enviarCorreo } = await import('../src/utils/correo.js');

const para = process.argv[2] || env.correo.sistemas;
console.log(`Servidor ${env.correo.host}:${env.correo.port} · remitente ${env.correo.from ?? '(SMTP_FROM vacío)'} · EHLO ${env.correo.ehlo} · para ${para}\n`);
const ok = await enviarCorreo({ para, asunto: 'Prueba de correo Intrapola', texto: 'Si recibe este mensaje, el envío de correo de la Intrapola funciona.' });
console.log(ok ? '\nOK: correo enviado' : '\nNo se envió (ver arriba)');
process.exit(ok ? 0 : 1);
