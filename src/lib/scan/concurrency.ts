/**
 * Run `tasks` with at most `limit` running concurrently, preserving input
 * order in the results. Each task is wrapped so a rejection becomes a settled
 * result rather than aborting the pool.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runner(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => runner()));
  return results;
}
