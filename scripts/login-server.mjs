#!/usr/bin/env node
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.TRACKER_HOST || "127.0.0.1";
const PORT = Number(process.env.TRACKER_PORT || 8765);
const OPEN_ON_LOGIN = ["true", "1", "yes"].includes(
  String(process.env.TRACKER_OPEN_ON_LOGIN || "false").toLowerCase(),
);
const URL = `http://${HOST}:${PORT}`;

function isAppRoot(dir) {
  return (
    existsSync(path.join(dir, "package.json")) &&
    existsSync(path.join(dir, "node_modules", "next"))
  );
}

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (isAppRoot(dir)) return dir;
    dir = path.resolve(dir, "..");
  }
  return start;
}

function resolveRoot() {
  const envRepo = process.env.TRACKER_REPO;
  if (envRepo && isAppRoot(envRepo)) return envRepo;
  return findRoot(path.dirname(fileURLToPath(import.meta.url)));
}

const ROOT = resolveRoot();

function shouldStartProduction(root) {
  if (process.env.TRACKER_NEXT_MODE === "dev") return false;
  if (process.env.TRACKER_NEXT_MODE === "start") return true;
  if (existsSync(path.join(root, ".next", "standalone", "server.js"))) return true;
  if (existsSync(path.join(root, ".git"))) return false;
  return existsSync(path.join(root, ".next", "BUILD_ID"));
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

function openBrowser() {
  if (!OPEN_ON_LOGIN) return;
  execFile("open", [URL], () => undefined);
}

async function waitForPort(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen()) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function waitWhilePortOpen(timeoutMs = 8_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await portOpen())) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return !(await portOpen());
}

async function isCurrentUi() {
  try {
    const response = await fetch(URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    const html = await response.text();
    return html.includes('data-theme') && html.includes('href="/chat"');
  } catch {
    return false;
  }
}

async function main() {
  if (await portOpen()) {
    if (await isCurrentUi()) {
      openBrowser();
      process.exit(0);
    }
    const freed = await waitWhilePortOpen(8_000);
    if (!freed) {
      console.error(
        `Port ${PORT} is serving an older tracker UI. Stop that process and retry.`,
      );
      process.exit(1);
    }
  }

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const mode = shouldStartProduction(ROOT) ? "start" : "dev";
  const child = spawn(
    process.execPath,
    [nextBin, mode, "-H", HOST, "-p", String(PORT)],
    {
      stdio: "inherit",
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: mode === "start" ? "production" : "development",
      },
    },
  );

  waitForPort()
    .then((ready) => {
      if (ready) openBrowser();
    })
    .catch(() => undefined);

  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
