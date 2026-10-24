"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, UserRole, OrganizerCategory } from "./types";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole, phone?: string) => Promise<{ needsConfirmation: boolean }>;
  logout: (redirectTo?: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  login: (user: User) => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  canAccessAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  signIn: async () => {},
  signUp: async () => ({ needsConfirmation: false }),
  logout: async () => {},
  updateProfile: async () => {},
  login: () => {},
  isSuperAdmin: false,
  isAdmin: false,
  isOrganizer: false,
  isStaff: false,
  isCustomer: false,
  canAccessAdmin: false,
});

export const SUPER_ADMIN_EMAIL = "munyah777@gmail.com";

export function isSuperAdminAccount(user: User): boolean {
  return user.email === SUPER_ADMIN_EMAIL;
}

// Fire-and-forget: tells the server to record an admin/super_admin
// login/logout in the audit trail. Never blocks or breaks auth if it fails —
// logging must not be able to lock anyone out.
async function logAuthEvent(action: "admin.login" | "admin.logout") {
  try {
    await fetch("/api/auth/login-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  } catch {
    // Best-effort only.
  }
}

function dbProfileToUser(profile: Record<string, unknown>): User {
  return {
    id: profile.id as string,
    name: (profile.name as string) || "",
    email: (profile.email as string) || "",
    phone: (profile.phone as string) || "",
    role: profile.role as UserRole,
    organizerId: profile.organizer_id as string | undefined,
    organizerCategory: profile.organizer_category as OrganizerCategory | undefined,
    organizerSubtype: profile.organizer_subtype as string | undefined,
    avatar: profile.avatar as string | undefined,
    verified: Boolean(profile.verified),
    isSuspended: Boolean(profile.is_suspended),
    createdAt: profile.created_at as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The user id whose profile is currently loaded / being loaded. Used to
  // drop stale responses and to skip redundant re-fetches on token refresh.
  const activeUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (activeUserIdRef.current !== userId) return;
      // Suspension can be applied to an already-active session — catch it here
      // too, not just at sign-in, so it takes effect on the next page load.
      if (profile?.is_suspended) {
        activeUserIdRef.current = null;
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }
      if (profile) {
        setUser(dbProfileToUser(profile));
        setLoading(false);
        return;
      }
      if (!error) break;
      // Transient read failure (network blip, slow mobile link, PostgREST
      // hiccup) — retry rather than flash a logged-out UI while the session
      // is actually fine.
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      if (activeUserIdRef.current !== userId) return;
    }
    // Never downgrade an already-loaded user to "logged out" because a
    // background profile refresh failed — only an auth SIGNED_OUT does that.
    console.error("Failed to fetch user profile for", userId);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // onAuthStateChange emits INITIAL_SESSION on subscribe, so it is the
    // single source of truth (a separate getSession() call raced it and
    // double-fetched the profile). Work is deferred out of the callback:
    // calling Supabase from inside it can deadlock the auth lock and stall
    // token refreshes, which surfaced as random sign-outs.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (!uid) {
        activeUserIdRef.current = null;
        setUser(null);
        setLoading(false);
        return;
      }
      // Token refreshes keep the same user — no need to reload the profile.
      if (event === "TOKEN_REFRESHED" && activeUserIdRef.current === uid) return;
      if (event !== "USER_UPDATED" && activeUserIdRef.current === uid) return;
      activeUserIdRef.current = uid;
      setTimeout(() => { fetchProfile(uid); }, 0);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.is_suspended) {
      await supabase.auth.signOut();
      throw new Error("This account has been suspended. Contact support if you believe this is a mistake.");
    }

    logAuthEvent("admin.login");
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    phone = ""
  ): Promise<{ needsConfirmation: boolean }> => {
    const supabase = createClient();
    const next = role === "organizer" ? "/creator" : "/";
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { name, role, phone, verified: false },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) throw new Error(error.message);
    // GoTrue returns a user with no identities (and no error) when the email
    // is already registered, to avoid leaking account existence — surface it
    // instead of telling the person to wait for an email that never comes.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("This email is already registered. Try signing in or reset your password.");
    }
    return { needsConfirmation: !data.session };
  };

  // Always lands on a fresh page so no stale client state (or an in-flight
  // navigation racing the cookie clear) can resurrect the old session.
  const logout = async (redirectTo = "/") => {
    const supabase = createClient();
    await logAuthEvent("admin.logout");
    activeUserIdRef.current = null;
    try {
      await supabase.auth.signOut();
    } catch {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    setUser(null);
    window.location.assign(redirectTo);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const supabase = createClient();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.organizerCategory !== undefined) dbUpdates.organizer_category = updates.organizerCategory;
    if (updates.organizerSubtype !== undefined) dbUpdates.organizer_subtype = updates.organizerSubtype;

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(dbUpdates)
      .eq("id", user.id)
      .select()
      .single();

    // Previously ignored — a failed save (RLS denial, network blip) looked
    // identical to a successful one: no error, no state change, no feedback.
    if (error) throw new Error(error.message);
    if (updated) setUser(dbProfileToUser(updated));
  };

  // Kept for places that do session-only updates without a DB round-trip
  const login = (updatedUser: User) => setUser(updatedUser);

  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const isOrganizer = role === "organizer";
  const isStaff = role === "staff";
  const isCustomer = role === "customer";
  const canAccessAdmin = isSuperAdmin || role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        signIn,
        signUp,
        logout,
        updateProfile,
        login,
        isSuperAdmin,
        isAdmin,
        isOrganizer,
        isStaff,
        isCustomer,
        canAccessAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Admin helper — queries profiles table server-side via admin client
// Use in server components or API routes only
export async function getRegisteredUsers(): Promise<User[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  return (data || []).map(dbProfileToUser);
}
