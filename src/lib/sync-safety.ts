/** Pure safety checks for candidate imports; no access to CRM data. */
export interface CandidateRef { id: string }
export function uniqueCandidateMatch<T extends CandidateRef>(rows: readonly T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('Ambiguous candidate identity; manual review required');
  return rows[0];
}
export function reconcileCandidateMatches<T extends CandidateRef>(
  mobile: T | null | undefined, email: T | null | undefined,
): T | null {
  if (mobile && email && mobile.id !== email.id) {
    throw new Error('Conflicting candidate identities; manual review required');
  }
  return mobile ?? email ?? null;
}
/** Treat imported email as a literal, not an ILIKE wildcard expression. */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
export function advanceContiguousCursor(previous: number, completedRow: number): number {
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(completedRow) ||
      previous < 1 || completedRow < 2 || completedRow !== previous + 1) {
    throw new Error('Non-contiguous candidate sync cursor; manual review required');
  }
  return completedRow;
}
