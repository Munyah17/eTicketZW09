"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, UserRole } from "./types";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (user: User) => void;
  logout: () => void;
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
  login: () => {},
  logout: () => {},
  isSuperAdmin: false,
  isAdmin: false,
  isOrganizer: false,
  isStaff: false,
  isCustomer: false,
  canAccessAdmin: false,
});

// Super admin identity — this account can never be deleted; password changes require email confirmation
export const SUPER_ADMIN_ID = "usr-super-001";
export const SUPER_ADMIN_EMAIL = "munyamuzvidziwa19@gmail.com";
export function isSuperAdminAccount(user: User): boolean {
  return user.id === SUPER_ADMIN_ID || user.email === SUPER_ADMIN_EMAIL;
}

// Super admin is the only built-in account; all other users register through the app
export const demoUsers: Partial<Record<UserRole, User>> = {
  super_admin: {
    id: SUPER_ADMIN_ID,
    name: "Munyah Griezmann",
    email: SUPER_ADMIN_EMAIL,
    phone: "+263773909307",
    role: "super_admin",
    verified: true,
    createdAt: "2023-01-01T00:00:00Z",
    password: "@@Griezmann177#$",
  },
};

const SESSION_KEY = "eticket_user";
const REGISTERED_USERS_KEY = "eticket_registered_users";

export function getRegisteredUsers(): User[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(REGISTERED_USERS_KEY);
    return stored ? (JSON.parse(stored) as User[]) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredUser(user: User): void {
  if (typeof window === "undefined") return;
  // Super admin account is managed in code only — it cannot be modified via localStorage
  if (isSuperAdminAccount(user)) return;
  const users = getRegisteredUsers();
  const idx = users.findIndex((u) => u.email === user.email);
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
}

function loadUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(loadUser());
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

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
        login,
        logout,
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
