import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthState {
  token: string | null;
  userId: string | null;
  name: string | null;
  setAuth: (token: string, userId: string, name: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      name: null,
      setAuth: (token, userId, name) => set({ token, userId, name }),
      clearAuth: () => set({ token: null, userId: null, name: null }),
    }),
    {
      name: "stadia_auth",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
