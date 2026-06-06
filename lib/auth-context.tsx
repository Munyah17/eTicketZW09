"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, UserRole, OrganizerCategory } from "./types";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole, phone?: string) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
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

export const SUPER_ADMIN_EMAIL = "munyamuzvidziwa19@gmail.com";

export function isSuperAdminAccount(user: User): boolean {
  return user.email === SUPER_ADMIN_EMAIL;
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
    createdAt: profile.created_at as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (profile) setUser(dbProfileToUser(profile));
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    phone = ""
  ): Promise<{ needsConfirmation: boolean }> => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, phone, verified: false },
      },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
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

    const { data: updated } = await supabase
      .from("profiles")
      .update(dbUpdates)
      .eq("id", user.id)
      .select()
      .single();

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
