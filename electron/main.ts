import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ErpnextSessionStore } from "@zatgo/erpnext";
import { OutboxStore } from "./outbox-store";
import { ReadCache } from "./read-cache";
import { SyncEngine } from "./sync-engine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const erpnext = new ErpnextSessionStore();

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, "../public");

let mainWindow: BrowserWindow | null = null;
let outbox: OutboxStore;
let readCache: ReadCache;
let syncEngine: SyncEngine;

function notifyOutboxChanged() {
  mainWindow?.webContents.send("outbox:changed", outbox.counts());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "ZatGo Accounting",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(process.env.DIST!, "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("desktop:getAppVersion", () => app.getVersion());
ipcMain.handle("desktop:getPlatform", () => process.platform);

ipcMain.handle(
  "erpnext:login",
  async (_event, payload: { baseUrl: string; usr: string; pwd: string }) => {
    const result = await erpnext.login(payload);
    if (!result.ok) return result;
    void syncEngine?.flush();
    return {
      ok: true as const,
      user: result.session.user,
      fullName: result.session.fullName,
      baseUrl: result.session.baseUrl,
    };
  },
);

ipcMain.handle("erpnext:logout", async () => {
  await erpnext.logout();
  return { ok: true as const };
});

ipcMain.handle("erpnext:getSession", () => {
  const s = erpnext.get();
  if (!s) return null;
  return { user: s.user, fullName: s.fullName, baseUrl: s.baseUrl };
});

ipcMain.handle(
  "erpnext:request",
  async (
    _event,
    payload: {
      path: string;
      method?: string;
      body?: string | null;
      headers?: Record<string, string>;
    },
  ) => erpnext.request(payload),
);

ipcMain.handle(
  "outbox:enqueue",
  (_event, payload: { entityType: string; clientId: string; method: string; args: Record<string, unknown> }) => {
    const item = outbox.enqueue(payload);
    notifyOutboxChanged();
    // Fire-and-forget an immediate attempt so a create feels instant when
    // actually online, without blocking the caller on the network result —
    // the item is already durably queued either way.
    void syncEngine.flush();
    return item;
  },
);

ipcMain.handle("outbox:list", (_event, status?: "pending" | "uploading" | "synced" | "failed") =>
  outbox.list(status),
);
ipcMain.handle("outbox:counts", () => outbox.counts());
ipcMain.handle("outbox:flush", () => syncEngine.flush());
ipcMain.handle("outbox:requeue", (_event, id: string) => {
  outbox.requeue(id);
  notifyOutboxChanged();
  void syncEngine.flush();
});
ipcMain.handle("outbox:requeueAllFailed", () => {
  const n = outbox.requeueAllFailed();
  notifyOutboxChanged();
  void syncEngine.flush();
  return n;
});

ipcMain.handle("cache:get", (_event, key: string) => readCache.get(key));
ipcMain.handle("cache:set", (_event, key: string, data: unknown[]) => readCache.set(key, data));

app.whenReady().then(() => {
  outbox = new OutboxStore(app.getPath("userData"));
  readCache = new ReadCache(app.getPath("userData"));
  syncEngine = new SyncEngine(outbox, erpnext, notifyOutboxChanged);
  outbox.requeueStuckUploads();

  createWindow();
  syncEngine.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  syncEngine?.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
