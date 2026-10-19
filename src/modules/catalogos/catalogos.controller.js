import * as repo from './catalogos.repository.js';
import { cached } from '../../utils/cache.js';

const TTL = 300; // 5 minutos

export const tiposSolicitud = async (req, res) =>
  res.json(await cached(`cat:tipos:${req.validQuery.area ?? '*'}`, TTL, () => repo.tiposSolicitud(req.validQuery.area)));

export const articulos = async (req, res) =>
  res.json(await cached(`cat:art:${req.validQuery.categoria}`, TTL, () => repo.articulos(req.validQuery.categoria)));

export const accesos = async (_req, res) => res.json(await cached('cat:accesos', TTL, repo.accesos));
export const tiposSoporte = async (_req, res) => res.json(await cached('cat:soporte', TTL, repo.tiposSoporte));
export const departamentos = async (_req, res) => res.json(await cached('cat:deptos', TTL, repo.departamentos));
