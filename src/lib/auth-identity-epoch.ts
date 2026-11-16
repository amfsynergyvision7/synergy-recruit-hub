/**
 * Build 115 — client-side Auth request invalidation.
 *
 * The gate does not grant server permissions. It only prevents an out-of-order
 * profile/role lookup from being rendered for the wrong browser identity.
 * Database RLS and approved-role server checks remain authoritative.
 */
export type VerifiedAppRole = "admin" | "recruiter" | "operations" | "finance" | "viewer";

export type AuthIdentityTicket = Readonly<{
  revision: number;
  userId: string | null;
}>;

export interface AuthIdentityEpoch {
  issue(userId: string | null): AuthIdentityTicket | null;
  accepts(ticket: AuthIdentityTicket): boolean;
  currentUser(): string | null;
  revision(): number;
  dispose(): void;
}

export function createAuthIdentityEpoch(): AuthIdentityEpoch {
  let revision = 0;
  let userId: string | null = null;
  let disposed = false;
  return {
    issue(nextId) {
      if (disposed) return null;
      if (nextId !== null && (typeof nextId !== "string" || nextId.length === 0))
        throw new Error("Auth identity must be a nonempty user ID");
      userId = nextId;
      revision += 1;
      return Object.freeze({ revision, userId });
    },
    accepts(ticket) {
      return !disposed && userId !== null &&
        ticket?.revision === revision && ticket.userId === userId;
    },
    currentUser() {
      return disposed ? null : userId;
    },
    revision() {
      return revision;
    },
    dispose() {
      disposed = true;
      userId = null;
      revision += 1;
    },
  };
}

export function authorizedRoleForProfile(
  userId: string,
  profile: unknown,
  roles: unknown,
): VerifiedAppRole | null {
  if (!profile || typeof profile !== "object" ||
      typeof userId !== "string" || userId.length === 0 ||
      !Array.isArray(roles)) return null;
  const p = profile as { id?: unknown; status?: unknown; is_active?: unknown };
  if (p.id !== userId || p.status !== "approved" || p.is_active !== true) return null;

  const priority: VerifiedAppRole[] = [
    "admin", "recruiter", "operations", "finance", "viewer",
  ];
  // Unexpected role values fail closed. No user-supplied metadata can grant a role.
  return priority.find((r) => roles.some((entry) =>
    entry && typeof entry === "object" && entry.role === r)) ?? null;
}
