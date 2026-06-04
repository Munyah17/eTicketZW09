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

// Demo users for testing different roles
export const demoUsers: Record<UserRole, User> = {
  super_admin: {
    id: "usr-super-001",
    name: "Munyah Griezmann",
    email: "munyamuzvidziwa19@gmail.com",
    phone: "+263773909307",
    role: "super_admin",
    verified: true,
    createdAt: "2023-01-01T00:00:00Z",
    password: "griezmann17",
  },
  admin: {
    id: "usr-admin-001",
    name: "Tendai Moyo",
    email: "admin@eticket.co.zw",
    phone: "+263771234567",
    role: "admin",
    verified: true,
    createdAt: "2023-03-15T00:00:00Z",
    password: "admin123",
  },
  organizer: {
    id: "usr-org-001",
    name: "Ghettocracy Entertainment",
    email: "info@ghettocracy.co.zw",
    phone: "+263773909307",
    role: "organizer",
    organizerId: "org-001",
    organizerCategory: "music_entertainment",
    organizerSubtype: "Comedy Club / Stand-up Comedian",
    verified: true,
    createdAt: "2023-06-15T00:00:00Z",
    password: "organizer123",
  },
  staff: {
    id: "usr-staff-001",
    name: "Tendai Nyamande",
    email: "tendai@ghettocracy.co.zw",
    phone: "+263771111111",
    role: "staff",
    organizerId: "org-001",
    verified: true,
    createdAt: "2024-01-10T00:00:00Z",
    password: "staff123",
  },
  customer: {
    id: "usr-cust-001",
    name: "Tatenda Moyo",
    email: "user@example.com",
    phone: "+263772345678",
    role: "customer",
    verified: true,
    createdAt: "2024-05-20T00:00:00Z",
    password: "user123",
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
