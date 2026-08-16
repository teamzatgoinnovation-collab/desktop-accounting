/**
 * Local-first write helper. Every create action goes through this instead
 * of calling the API directly — it always writes to the durable local
 * outbox first, unconditionally, exactly like flutter-van-sale's pattern:
 * never require a network round trip to "create" something. The sync
 * engine in the Electron main process pushes it to ERPNext afterward,
 * synchronously if reachable right now, otherwise on its own retry
 * schedule.
 */

export type QueuedWrite = { clientId: string; queuedId: string };

/**
 * Enqueue a create-family write. `method` is a dotted ZatGoApi method
 * string (e.g. `ZatGoApi.accounting.customersCreate`) — the backend
 * endpoint must accept a `client_id` for this to be safely retryable.
 */
export async function enqueueCreate(input: {
  entityType: string;
  method: string;
  args: Record<string, unknown>;
}): Promise<QueuedWrite> {
  if (!window.zatgoDesktop?.outboxEnqueue) {
    throw new Error("Offline queue requires the Electron app.");
  }
  const clientId = crypto.randomUUID();
  const item = await window.zatgoDesktop.outboxEnqueue({
    entityType: input.entityType,
    clientId,
    method: input.method,
    args: { ...input.args, client_id: clientId },
  });
  return { clientId, queuedId: item.id };
}

/**
 * Cache-then-network read for picker/list data. Returns cached data
 * immediately if present, replaced by fresh data once the network call
 * resolves; if the network call fails and a cache exists, falls back to
 * the cache silently (marked `stale`) instead of throwing.
 */
export async function loadCachedList<T>(
  cacheKey: string,
  fetcher: () => Promise<T[]>,
): Promise<{ data: T[]; stale: boolean }> {
  let cached: T[] = [];
  if (window.zatgoDesktop?.cacheGet) {
    try {
      const entry = await window.zatgoDesktop.cacheGet(cacheKey);
      if (entry) cached = entry.data as T[];
    } catch {
      // Cache read failures are non-fatal — just proceed as if uncached.
    }
  }
  try {
    const fresh = await fetcher();
    if (window.zatgoDesktop?.cacheSet) {
      void window.zatgoDesktop.cacheSet(cacheKey, fresh as unknown[]);
    }
    return { data: fresh, stale: false };
  } catch (e) {
    if (cached.length) return { data: cached, stale: true };
    throw e;
  }
}
