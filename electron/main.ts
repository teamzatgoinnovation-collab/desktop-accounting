import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ErpnextSessionStore } from "@zatgo/erpnext";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const erpnext = new ErpnextSessionStore();

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, "../public");

let mainWindow: BrowserWindow | null = null;

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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
