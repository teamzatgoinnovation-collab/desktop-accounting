import { contextBridge, ipcRenderer } from "electron";

export type ErpnextLoginResult =
  | { ok: true; user: string; fullName: string; baseUrl: string }
  | { ok: false; message: string };

export type ErpnextSessionInfo = {
  user: string;
  fullName: string;
  baseUrl: string;
};

export type ZatGoDesktopApi = {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
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

const api: ZatGoDesktopApi = {
  getAppVersion: () => ipcRenderer.invoke("desktop:getAppVersion"),
  getPlatform: () => ipcRenderer.invoke("desktop:getPlatform"),
  erpnextLogin: (input) => ipcRenderer.invoke("erpnext:login", input),
  erpnextLogout: () => ipcRenderer.invoke("erpnext:logout"),
  erpnextGetSession: () => ipcRenderer.invoke("erpnext:getSession"),
  erpnextRequest: (input) => ipcRenderer.invoke("erpnext:request", input),
};

contextBridge.exposeInMainWorld("zatgoDesktop", api);
