import * as repo from './eventos.repository.js';
import { cached } from '../../utils/cache.js';

export const listar = async (req, res) =>
  res.json(await cached(`eventos:${req.validQuery.limite}`, 300, () => repo.listar(req.validQuery.limite)));
