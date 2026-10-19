import * as repo from './directorio.repository.js';
import { cached } from '../../utils/cache.js';

export const extensiones = async (_req, res) => res.json(await cached('dir:ext', 120, repo.extensiones));
export const emergencias = async (_req, res) => res.json(await cached('dir:emer', 600, () => repo.contactos('EMERGENCIA')));
export const proveedores = async (_req, res) => res.json(await cached('dir:prov', 600, () => repo.contactos('PROVEEDOR')));
