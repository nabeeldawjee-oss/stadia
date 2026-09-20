import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  name: string | null;
  setAuth: (token: string, userId: string, email: string, name: string) => void;
  setName: (name: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      name: null,
      setAuth: (token, userId, email, name) => {
        localStorage.setItem("stadia_token", token);
        set({ token, userId, email, name });
      },
      setName: (name) => set({ name }),
      clearAuth: () => {
        localStorage.removeItem("stadia_token");
        set({ token: null, userId: null, email: null, name: null });
      },
    }),
    { name: "stadia_auth", partialize: (s) => ({ token: s.token, userId: s.userId, email: s.email, name: s.name }) }
  )
);
