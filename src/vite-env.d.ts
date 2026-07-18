/// <reference types="vite/client" />

type ErpnextLoginResult =
  | { ok: true; user: string; fullName: string; baseUrl: string }
  | { ok: false; message: string };

type ErpnextSessionInfo = {
  user: string;
  fullName: string;
  baseUrl: string;
};

type ZatGoDesktopApi = {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  erpnextLogin: (input: {
    baseUrl: string;
    usr: string;
    pwd: string;
  }) => Promise<ErpnextLoginResult>;
  erpnextLogout: () => Promise<{ ok: true }>;
  erpnextGetSession: () => Promise<ErpnextSessionInfo | null>;
  erpnextRequest: (input: {
    path: string;
    method?: string;
    body?: string | null;
    headers?: Record<string, string>;
  }) => Promise<{ ok: boolean; status: number; bodyText: string }>;
};

declare global {
  interface Window {
    zatgoDesktop?: ZatGoDesktopApi;
  }
}

interface ImportMetaEnv {
  readonly VITE_FRAPPE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
