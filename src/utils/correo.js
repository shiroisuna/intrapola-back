import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/*
 * Envío de correos por el conector de Office 365 (puerto 25 + STARTTLS, sin credenciales),
 * igual que EnviarCorreo() en la Intrapola actual. El conector autoriza por IP: el servidor
 * donde corra esta API debe estar autorizado en Exchange Online, como lo está el IIS.
 */
let transporte;
function obtenerTransporte() {
  transporte ??= nodemailer.createTransport({
    host: env.correo.host,
    port: env.correo.port,
    secure: false,
    requireTLS: true, // EnableSsl = true en el C#
    name: env.correo.ehlo,
    connectionTimeout: 30000,
    tls: { servername: env.correo.host },
    logger: env.correo.debug,
    debug: env.correo.debug,
  });
  return transporte;
}

/** Devuelve true si se envió. Nunca lanza: un correo fallido no debe tumbar la solicitud. */
export async function enviarCorreo({ para, asunto, texto, html, remitente = 'Sistemas Amapola' }) {
  if (!env.correo.from) {
    console.warn('[correo] SMTP_FROM no está configurado; no se envió:', asunto);
    return false;
  }
  try {
    await obtenerTransporte().sendMail({
      from: { name: remitente, address: env.correo.from },
      to: para,
      subject: asunto,
      text: texto,
      html,
    });
    return true;
  } catch (err) {
    console.error(`[correo] no se pudo enviar "${asunto}": ${err.message}`);
    return false;
  }
}
