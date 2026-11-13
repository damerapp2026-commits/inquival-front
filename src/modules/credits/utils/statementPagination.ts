const PAGE_SIZE = 200;

/** Statement exports must not silently stop at the first page of an account. */
export async function collectStatementPages<T extends { id: string }>(read: (page: number, limit: number) => Promise<{ data: T[]; total: number } | T[]>): Promise<T[]> {
  const items = new Map<string, T>();
  for (let page = 1; ; page += 1) {
    const response = await read(page, PAGE_SIZE);
    if (Array.isArray(response)) {
      response.forEach(item => items.set(item.id, item));
      return [...items.values()];
    }
    if (!Array.isArray(response?.data) || !Number.isFinite(response.total) || response.total < 0) throw new Error('No se pudo leer el historial completo del cliente.');
    const previousCount = items.size;
    response.data.forEach(item => items.set(item.id, item));
    if (items.size >= response.total) return [...items.values()];
    if (items.size === previousCount) throw new Error('No se pudo completar el historial del cliente. Inténtalo nuevamente.');
  }
}
