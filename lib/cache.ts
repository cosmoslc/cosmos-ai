// Oddiy "stale-while-revalidate" kesh: sahifaga qaytganda oldingi ma'lumot darhol
// ko'rinadi, orqa fonda yangisi olinib, o'zgargan bo'lsa yangilanadi.
// Kesh faqat xotirada — sahifa to'liq yangilansa (F5) tozalanadi.
const store = new Map<string, unknown>();

export function peek<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCache<T>(key: string, value: T) {
  store.set(key, value);
}

export function invalidate(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

// Keshdagi qiymat bo'lsa onData'ni darhol chaqiradi, so'ng fetcher natijasi bilan yana chaqiradi.
// `isActive` false bo'lsa (effekt tozalangan) natija e'tiborga olinmaydi.
export async function swr<T>(key: string, fetcher: () => Promise<T>, onData: (data: T) => void, isActive: () => boolean = () => true): Promise<void> {
  const cached = peek<T>(key);
  if (cached !== undefined && isActive()) onData(cached);
  const fresh = await fetcher();
  store.set(key, fresh);
  if (isActive()) onData(fresh);
}
