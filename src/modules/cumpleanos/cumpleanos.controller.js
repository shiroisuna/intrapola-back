import * as repo from './cumpleanos.repository.js';
import { cached } from '../../utils/cache.js';

export async function delMes(req, res) {
  const mes = req.validQuery.mes ?? new Date().getMonth() + 1;
  res.json({ mes, cumpleaneros: await cached(`cumple:${mes}`, 3600, () => repo.delMes(mes)) });
}
