/** Build119: isolate all React Query cache data across Auth identities. */
export interface PrivateCacheFence {
  changed(nextId: string | null, force?: boolean): boolean;
  current(): string | null;
}
export function createPrivateCacheFence(): PrivateCacheFence {
  let initialized = false;
  let owner: string | null = null;
  return {
    changed(nextId, force = false) {
      if (nextId !== null && (typeof nextId !== "string" || !nextId))
        throw new Error("Invalid signed-in cache subject");
      const changed = !initialized || owner !== nextId;
      initialized = true;
      owner = nextId;
      return changed || force;
    },
    current: () => owner,
  };
}
export function clearPrivateCacheForIdentity(
  fence: PrivateCacheFence,
  client: { clear(): void },
  nextId: string | null,
  force = false,
): boolean {
  if (!fence.changed(nextId, force)) return false;
  // QueryClient.clear synchronously purges both query and mutation caches.
  client.clear();
  return true;
}
