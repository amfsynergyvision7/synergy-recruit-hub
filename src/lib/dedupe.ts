// Shared normalization helpers for "is this the same person" comparisons.
// Used by two features that both need to answer that question:
//   - The Google Drive bulk-import (drive-import.server.ts), which checks
//     each incoming resume against existing candidates before creating one.
//   - The Duplicate Candidates cleanup tool (duplicates.server.ts), which
//     scans the entire existing table for likely duplicates.
// Keeping the exact same normalization in one place means a candidate that
// the import feature correctly matched won't later show up as a "false"
// duplicate (or vice versa) just because the two features drifted apart.

export function normalizeEmail(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }
  
  export function normalizePhone(value: string | null): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return null;
    // Compare on the last 10 digits so +91-prefixed, 0-prefixed, and bare
    // 10-digit numbers all match each other.
    return digits.length > 10 ? digits.slice(-10) : digits;
  }
  
  export function normalizeName(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
    return trimmed.length > 0 ? trimmed : null;
  }