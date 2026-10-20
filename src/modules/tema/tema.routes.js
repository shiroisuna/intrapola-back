import { Router } from 'express';
import * as tema from './tema.service.js';

const router = Router();
// Público: el frontend lo pide al cargar
router.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(tema.leer());
});
export default router;
