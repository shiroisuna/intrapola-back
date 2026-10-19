import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

const ALLOWED = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.doc', '.docx', '.xls', '.xlsx', '.txt']);

/** Middleware de subida para un módulo: guarda en uploads/<carpeta>/ con nombre único. */
export function uploader(carpeta) {
  const dir = path.resolve(env.uploadsDir, carpeta);
  fs.mkdirSync(dir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED.has(ext)) return cb(badRequest(`Tipo de archivo no permitido (${ext})`));
      cb(null, true);
    },
  });
}

/** Igual que uploader() pero deja el archivo en memoria (req.file.buffer), para copiarlo a otra ruta. */
export function uploaderMemoria() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED.has(ext)) return cb(badRequest(`Tipo de archivo no permitido (${ext})`));
      cb(null, true);
    },
  });
}

/** URL pública de un archivo subido. */
export const publicUrl = (carpeta, file) => (file ? `/uploads/${carpeta}/${file.filename}` : null);
