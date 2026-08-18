const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const { createConnection } = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOST = process.env.TRACKER_HOST || "127.0.0.1";
const PORT = Number(process.env.TRACKER_PORT || 8765);
const APP_URL = `http://${HOST}:${PORT}`;
const SUPPORT_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "SDERoutineTracker",
);

let serverProcess = null;
let mainWindow = null;
let isQuitting = false;

function supportEnvPath() {
  return path.join(SUPPORT_DIR, ".env.local");
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cut = trimmed.indexOf("=");
    if (cut < 1) continue;
    const key = trimmed.slice(0, cut).trim();
    let value = trimmed.slice(cut + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function portOpen() {
  return new Promise((resolve) => {
    const sock = createConnection({ host: HOST, port: PORT });
    const done = (isOpen) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(isOpen);
    };
    sock.setTimeout(400);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

async function waitForPort(timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function findServer(root) {
  const direct = path.join(root, "server.js");
  if (fs.existsSync(direct)) return { cwd: root, file: direct };
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(root, entry.name, "server.js");
    if (fs.existsSync(nested)) {
      return { cwd: path.join(root, entry.name), file: nested };
    }
  }
  return null;
}

function copyRepoEnvIfNeeded() {
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  const dest = supportEnvPath();
  const src = path.join(repoRoot(), ".env.local");
  if (!fs.existsSync(dest) && fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

function spawnServer() {
  copyRepoEnvIfNeeded();
  loadEnvFile(supportEnvPath());
  loadEnvFile(path.join(repoRoot(), ".env.local"));

  if (app.isPackaged) {
    const located = findServer(path.join(process.resourcesPath, "standalone"));
    if (!located) {
      throw new Error("Packaged Next server is missing (standalone/server.js).");
    }
    serverProcess = spawn(process.execPath, [located.file], {
      cwd: located.cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(PORT),
        HOSTNAME: HOST,
        TRACKER_HOST: HOST,
        TRACKER_PORT: String(PORT),
      },
      stdio: "pipe",
    });
  } else {
    const nextBin = path.join(
      repoRoot(),
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    );
    const nodeBin = process.env.npm_node_execpath || process.execPath;
    serverProcess = spawn(
      nodeBin,
      [nextBin, "dev", "-H", HOST, "-p", String(PORT)],
      {
        cwd: repoRoot(),
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "development",
          TRACKER_HOST: HOST,
          TRACKER_PORT: String(PORT),
        },
        stdio: "pipe",
      },
    );
  }

  serverProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  serverProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (code && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        "Daily Routine",
        "The local server stopped. Quit and open the app again.",
      );
    }
  });
}

function installMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Open in Browser",
          click: () => shell.openExternal(APP_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Daily Routine",
    backgroundColor: "#11111b",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  await mainWindow.loadURL(APP_URL);
  mainWindow.show();
}

async function isCurrentUi() {
  try {
    const response = await fetch(APP_URL, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    const html = await response.text();
    return html.includes("data-theme") && html.includes('href="/chat"');
  } catch {
    return false;
  }
}

async function boot() {
  copyRepoEnvIfNeeded();
  loadEnvFile(supportEnvPath());
  loadEnvFile(path.join(repoRoot(), ".env.local"));

  if (await portOpen()) {
    if (!(await isCurrentUi())) {
      dialog.showErrorBox(
        "Daily Routine",
        "Port 8765 is serving an older tracker UI (the previous top-nav landing page from the login item). Stop that process, then open the app again.",
      );
      app.quit();
      return;
    }
  } else {
    spawnServer();
    const ready = await waitForPort();
    if (!ready) {
      dialog.showErrorBox(
        "Daily Routine",
        "Could not start the local server on port 8765. Is Postgres running? First run creates database sde_tracker automatically (docker compose up -d, or local Postgres on 5432).",
      );
      app.quit();
      return;
    }
  }

  installMenu();
  await createWindow();
}

app.setName("Daily Routine");
app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: false, openAsHidden: false });
  boot().catch((error) => {
    dialog.showErrorBox("Daily Routine", String(error));
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(() => undefined);
  } else {
    BrowserWindow.getAllWindows()[0]?.show();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
});
