import { contextBridge, ipcRenderer } from "electron";

export type ErpnextLoginResult =
  | { ok: true; user: string; fullName: string; baseUrl: string }
  | { ok: false; message: string };

export type ErpnextSessionInfo = {
  user: string;
  fullName: string;
  baseUrl: string;
};

export type OutboxStatus = "pending" | "uploading" | "synced" | "failed";

export type OutboxItem = {
  id: string;
  clientId: string;
  entityType: string;
  method: string;
  argsJson: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  resultName: string | null;
  resultDataJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutboxCounts = Record<OutboxStatus, number>;

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
  outboxEnqueue: (input: {
    entityType: string;
    clientId: string;
    method: string;
    args: Record<string, unknown>;
  }) => Promise<OutboxItem>;
  outboxList: (status?: OutboxStatus) => Promise<OutboxItem[]>;
  outboxCounts: () => Promise<OutboxCounts>;
  outboxFlush: () => Promise<{ uploaded: number; failed: number; skipped?: string }>;
  outboxRequeue: (id: string) => Promise<void>;
  outboxRequeueAllFailed: () => Promise<number>;
  onOutboxChanged: (cb: (counts: OutboxCounts) => void) => () => void;
  cacheGet: (key: string) => Promise<{ data: unknown[]; updatedAt: string } | null>;
  cacheSet: (key: string, data: unknown[]) => Promise<void>;
};

const api: ZatGoDesktopApi = {
  getAppVersion: () => ipcRenderer.invoke("desktop:getAppVersion"),
  getPlatform: () => ipcRenderer.invoke("desktop:getPlatform"),
  erpnextLogin: (input) => ipcRenderer.invoke("erpnext:login", input),
  erpnextLogout: () => ipcRenderer.invoke("erpnext:logout"),
  erpnextGetSession: () => ipcRenderer.invoke("erpnext:getSession"),
  erpnextRequest: (input) => ipcRenderer.invoke("erpnext:request", input),
  outboxEnqueue: (input) => ipcRenderer.invoke("outbox:enqueue", input),
  outboxList: (status) => ipcRenderer.invoke("outbox:list", status),
  outboxCounts: () => ipcRenderer.invoke("outbox:counts"),
  outboxFlush: () => ipcRenderer.invoke("outbox:flush"),
  outboxRequeue: (id) => ipcRenderer.invoke("outbox:requeue", id),
  outboxRequeueAllFailed: () => ipcRenderer.invoke("outbox:requeueAllFailed"),
  onOutboxChanged: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, counts: OutboxCounts) => cb(counts);
    ipcRenderer.on("outbox:changed", listener);
    return () => ipcRenderer.removeListener("outbox:changed", listener);
  },
  cacheGet: (key) => ipcRenderer.invoke("cache:get", key),
  cacheSet: (key, data) => ipcRenderer.invoke("cache:set", key, data),
};

contextBridge.exposeInMainWorld("zatgoDesktop", api);
