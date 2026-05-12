import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "recruiter" | "operations" | "finance" | "viewer";
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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    if (roles && roles.length) {
      const order: AppRole[] = ["admin", "recruiter", "operations", "finance", "viewer"];
      const found = order.find((r) => roles.some((x: any) => x.role === r));
      setRole((found ?? "viewer") as AppRole);
    } else setRole(null);
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) await loadProfile(s.user.id);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
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
