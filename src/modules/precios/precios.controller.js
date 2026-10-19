import * as repo from './precios.repository.js';
import { cached } from '../../utils/cache.js';

export const vigentes = async (_req, res) => res.json(await cached('precios', 300, repo.vigentes));
