/**
 * Executor com concorrencia limitada. Mantem N produtos em voo ao mesmo tempo
 * para nao estourar o rate limit por custo da Admin API.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const limit = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runner(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runner()));
  return results;
}
