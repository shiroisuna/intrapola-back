/** Caché en memoria con expiración, para catálogos y contenido que cambia poco. */
const store = new Map();

export async function cached(key, ttlSeconds, loader) {
  const hit = store.get(key);
  if (hit && hit.expira > Date.now()) return hit.valor;
  const valor = await loader();
  store.set(key, { valor, expira: Date.now() + ttlSeconds * 1000 });
  return valor;
}

export function invalidate(prefix = '') {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
