/// <reference types="vite/client" />

declare global {
  type ErpnextLoginResult =
    | { ok: true; user: string; fullName: string; baseUrl: string }
    | { ok: false; message: string };

  type ErpnextSessionInfo = {
    user: string;
    fullName: string;
    baseUrl: string;
  };

  type OutboxStatus = "pending" | "uploading" | "synced" | "failed";

  type OutboxItem = {
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

  type OutboxCounts = Record<OutboxStatus, number>;

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
