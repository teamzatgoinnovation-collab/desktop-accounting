import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectionConfig = {
  baseUrl: string;
};

type SessionState = {
  connection: ConnectionConfig;
  connected: boolean;
  user: string | null;
  fullName: string | null;
  lastError: string | null;
  setSession: (input: {
    connected: boolean;
    user?: string | null;
    fullName?: string | null;
    error?: string | null;
    baseUrl?: string;
  }) => void;
  clearSession: () => void;
};

const defaultBaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_FRAPPE_BASE_URL) ||
  "https://accounting.zatgo.online";

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      connection: { baseUrl: defaultBaseUrl },
      connected: false,
      user: null,
      fullName: null,
      lastError: null,
      setSession: ({ connected, user = null, fullName = null, error = null, baseUrl }) =>
        set((state) => ({
          connected,
          user,
          fullName,
          lastError: error,
          connection: baseUrl
            ? { ...state.connection, baseUrl }
            : state.connection,
        })),
      clearSession: () =>
        set((state) => ({
          connected: false,
          user: null,
          fullName: null,
          lastError: null,
          connection: state.connection,
        })),
    }),
    {
      name: "zatgo-accounting-desktop-session",
      // baseUrl is intentionally NOT persisted — it always comes fresh from
      // VITE_FRAPPE_BASE_URL (.env) on every launch, not a cached override.
      // Nothing else in session state should survive a restart either — a
      // fresh launch always re-hydrates from a live ERPNext session check.
      partialize: () => ({}),
    },
  ),
);
