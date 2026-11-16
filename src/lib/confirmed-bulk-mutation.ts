// Build60 — shared, bounded, confirm-before-success bulk DML safety.
// Applies ONLY when the caller's independent business/RLS guards permit DML.
// No automatic retry: a network exception may happen AFTER a server commit.
export interface BulkMutationReply {
  data: readonly { id: string }[] | null;
  error?: { message?: string } | null;
}
export interface ConfirmedBulkOutcome {
  complete: boolean;
  confirmedCount: number;
  requestedCount: number;
  message: string;
}
export async function runConfirmedBulkMutation(
  ids: readonly string[],
  dispatch: (batch: string[]) => Promise<BulkMutationReply>,
): Promise<ConfirmedBulkOutcome> {
  const requestedCount = ids.length;
  const confirmed = new Set<string>();
  if (!requestedCount || ids.some((id) => !id || typeof id !== "string") ||
      new Set(ids).size !== requestedCount) {
    return { complete: false, confirmedCount: 0, requestedCount,
      message: "Invalid or duplicate selected IDs; nothing dispatched." };
  }
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const expected = new Set(batch);
    let reply: BulkMutationReply;
    try {
      reply = await dispatch(batch);
    } catch {
      // Never log/echo network exceptions; they may include private provider
      // detail. More importantly, their outcome may have already committed.
      return { complete: false, confirmedCount: confirmed.size, requestedCount,
        message: "Network or client outcome unknown; the last batch may have committed." };
    }
    if (reply.error || !Array.isArray(reply.data)) {
      return { complete: false, confirmedCount: confirmed.size, requestedCount,
        message: "Server did not confirm the requested batch." };
    }
    const returned = reply.data.map((row) => row?.id);
    const responseIds = new Set(returned);
    if (returned.length !== batch.length || responseIds.size !== batch.length ||
        returned.some((id) => !expected.has(id))) {
      // The server may have applied an unknown subset before responding.
      // Count only unambiguous IDs, never imply full success or replay.
      for (const id of responseIds) if (expected.has(id)) confirmed.add(id);
      return { complete: false, confirmedCount: confirmed.size, requestedCount,
        message: "Partial or inconsistent row-ID confirmation; other outcomes remain unknown." };
    }
    for (const id of returned) confirmed.add(id);
  }
  return { complete: true, confirmedCount: confirmed.size, requestedCount,
    message: "Every requested record ID was confirmed." };
}
