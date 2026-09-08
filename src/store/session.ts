import { create } from "zustand";

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

// Plain in-memory store, no browser storage — every launch always re-hydrates
// from a live ERPNext session check, never a cached value.
export const useSessionStore = create<SessionState>()((set) => ({
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
      connection: baseUrl ? { ...state.connection, baseUrl } : state.connection,
    })),
  clearSession: () =>
    set((state) => ({
      connected: false,
      user: null,
      fullName: null,
      lastError: null,
      connection: state.connection,
    })),
}));
