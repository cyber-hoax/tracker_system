#!/usr/bin/env node
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.TRACKER_HOST || "127.0.0.1";
const PORT = Number(process.env.TRACKER_PORT || 8765);
const OPEN_ON_LOGIN = !["false", "0", "no"].includes(
  String(process.env.TRACKER_OPEN_ON_LOGIN || "true").toLowerCase(),
);
const URL = `http://${HOST}:${PORT}`;

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 4; i += 1) {
    if (
      existsSync(path.join(dir, "package.json")) &&
      existsSync(path.join(dir, "node_modules", "next"))
    ) {
      return dir;
    }
    dir = path.resolve(dir, "..");
  }
  return start;
}

const ROOT = findRoot(path.dirname(fileURLToPath(import.meta.url)));

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

async function main() {
  if (await portOpen()) {
    openBrowser();
    process.exit(0);
  }

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(
    process.execPath,
    [nextBin, "start", "-H", HOST, "-p", String(PORT)],
    {
      stdio: "inherit",
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: "production" },
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
