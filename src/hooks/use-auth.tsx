import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createPrivateCacheFence, clearPrivateCacheForIdentity, needsRoleTransitionPurge } from "@/lib/private-query-cache-fence";
import {
  authorizedRoleForProfile,
  createAuthIdentityEpoch,
  type AuthIdentityEpoch,
  type AuthIdentityTicket,
  type VerifiedAppRole,
} from "@/lib/auth-identity-epoch";

export type AppRole = VerifiedAppRole;
export type UserStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role_request: string | null;
  status: UserStatus;
  is_active: boolean;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null, user: null, profile: null, role: null, loading: true,
  refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const privateCacheOwner = useRef(createPrivateCacheFence());
  const lastApprovedRole = useRef<AppRole | null>(null);
  const purgePrivateQueries = (userId: string | null, force = false) =>
    clearPrivateCacheForIdentity(privateCacheOwner.current, queryClient, userId, force);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const identity = useRef<AuthIdentityEpoch>(createAuthIdentityEpoch());

  // Never commit a role/profile from an outdated sign-in, account switch,
  // refresh, or an effect that has already been disposed.
  const loadProfile = async (gate: AuthIdentityEpoch, ticket: AuthIdentityTicket) => {
    // A scheduled lookup for an earlier account must not even issue a
    // database read after sign-out, switching users, or a later refresh.
    if (!ticket.userId || !gate.accepts(ticket)) return;
    try {
      const [{ data: prof, error: profileError }, { data: roles, error: rolesError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", ticket.userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", ticket.userId),
        ]);
      if (!gate.accepts(ticket)) return;
      const matchedProfile: Profile | null =
        !profileError && prof?.id === ticket.userId ? (prof as Profile) : null;
      const nextRole = !rolesError
        ? authorizedRoleForProfile(ticket.userId, matchedProfile, roles)
        : null;
      // Account unchanged, but privileges may have been suspended,
      // revoked or downgraded since the previous signed-in event.
      if (needsRoleTransitionPurge(lastApprovedRole.current, nextRole))
        purgePrivateQueries(ticket.userId, true);
      lastApprovedRole.current = nextRole;
      setProfile(matchedProfile);
      setRole(nextRole);
    } catch {
      if (gate.accepts(ticket)) {
        if (needsRoleTransitionPurge(lastApprovedRole.current, null))
          purgePrivateQueries(ticket.userId, true);
        lastApprovedRole.current = null;
        setProfile(null);
        setRole(null);
      }
    } finally {
      if (gate.accepts(ticket)) setLoading(false);
    }
  };

  const refresh = async () => {
    const gate = identity.current;
    const userId = gate.currentUser();
    if (!userId) return;
    const ticket = gate.issue(userId);
    if (!ticket) return;
    // A permission refresh may revoke access to cached private records.
    purgePrivateQueries(userId, true);
    // Role and profile are invalid until the NEW request completes.
    setProfile(null);
    setRole(null);
    setLoading(true);
    await loadProfile(gate, ticket);
  };

  useEffect(() => {
    const gate = createAuthIdentityEpoch();
    identity.current = gate;
    let receivedAuthEvent = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const publish = (next: Session | null) => {
      const ticket = gate.issue(next?.user?.id ?? null);
      if (!ticket) return;
      // Clear query AND mutation caches before rendering a new Auth subject.
      const priorId = privateCacheOwner.current.current();
      purgePrivateQueries(ticket.userId);
      if (priorId !== ticket.userId) lastApprovedRole.current = null;
      // Clear old privileges synchronously with the session identity change.
      setSession(next);
      setProfile(null);
      setRole(null);
      if (!ticket.userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      // Supabase auth callbacks must remain synchronous and fast; querying
      // profiles inside the callback can re-enter Auth and stall the event.
      const timer = setTimeout(() => {
        timers.delete(timer);
        void loadProfile(gate, ticket);
      }, 0);
      timers.add(timer);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      receivedAuthEvent = true;
      publish(next);
    });
    // A late initial getSession result must never resurrect an account after
    // SIGNED_OUT, signOut(), or a newer auth event / explicit refresh.
    const initialRevision = gate.revision();
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!receivedAuthEvent && gate.revision() === initialRevision)
        publish(error ? null : data.session);
    }).catch(() => {
      if (!receivedAuthEvent && gate.revision() === initialRevision)
        publish(null);
    });

    return () => {
      gate.dispose();
      for (const timer of timers) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = async () => {
    // Invalidate pending role fetches before awaiting a remote sign-out.
    identity.current.issue(null);
    // Purge prior-user queries before awaiting a remote Auth request.
    purgePrivateQueries(null, true);
    lastApprovedRole.current = null;
    setSession(null);
    setProfile(null);
    setRole(null);
    setLoading(false);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, role, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export function canEdit(role: AppRole | null, module: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  if (role === "viewer") return false;
  switch (module) {
    case "candidates":
    case "submissions":
    case "interviews":
    case "clients":
    case "jobs":
      return role === "recruiter";
    case "offers":
      return role === "operations" || role === "recruiter";
    case "billing":
      return role === "finance";
    case "users":
    case "settings":
    case "audit":
      return false;
    default:
      return false;
  }
}

export function canDelete(role: AppRole | null): boolean {
  return role === "admin";
}
