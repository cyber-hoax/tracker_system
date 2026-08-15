import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/lib/config";
import {
  LAUNCH_AGENT_LABEL,
  launchAgentPath,
  logDir,
  supportDir,
} from "../src/lib/paths";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COPY_FILES = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "next-env.d.ts",
  "config.yaml",
];

const COPY_DIRS = ["src", "data"];

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function run(
  command: string,
  args: string[],
  cwd?: string,
): { ok: boolean; stdout: string; stderr: string; status: number } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status ?? 1,
  };
}

function copyRuntime(target: string): void {
  mkdirSync(target, { recursive: true });
  for (const name of COPY_FILES) {
    const src = path.join(repoRoot, name);
    if (!existsSync(src)) continue;
    copyFileSync(src, path.join(target, name));
  }
  for (const name of COPY_DIRS) {
    const src = path.join(repoRoot, name);
    if (!existsSync(src)) continue;
    cpSync(src, path.join(target, name), { recursive: true });
  }
  const envLocal = path.join(repoRoot, ".env.local");
  const envExample = path.join(repoRoot, ".env.example");
  if (existsSync(envLocal)) {
    copyFileSync(envLocal, path.join(target, ".env.local"));
  } else if (existsSync(envExample) && !existsSync(path.join(target, ".env.local"))) {
    copyFileSync(envExample, path.join(target, ".env.local"));
  }
  const publicDir = path.join(repoRoot, "public");
  if (existsSync(publicDir)) {
    cpSync(publicDir, path.join(target, "public"), { recursive: true });
  }
  mkdirSync(path.join(target, "scripts"), { recursive: true });
  copyFileSync(
    path.join(repoRoot, "scripts", "login-server.mjs"),
    path.join(target, "scripts", "login-server.mjs"),
  );
}

function plistBody(nodePath: string, workdir: string): string {
  const cfg = loadConfig();
  const script = path.join(workdir, "scripts", "login-server.mjs");
  const stdout = path.join(logDir(), "launchd.out.log");
  const stderr = path.join(logDir(), "launchd.err.log");
  const pathValue = [
    path.dirname(nodePath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].join(":");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(LAUNCH_AGENT_LABEL)}</string>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(workdir)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(script)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(stderr)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xmlEscape(pathValue)}</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>TRACKER_HOST</key>
    <string>${xmlEscape(cfg.host)}</string>
    <key>TRACKER_PORT</key>
    <string>${cfg.port}</string>
    <key>TRACKER_OPEN_ON_LOGIN</key>
    <string>${cfg.openOnLogin ? "true" : "false"}</string>
  </dict>
</dict>
</plist>
`;
}

function uid(): string {
  return String(os.userInfo().uid);
}

function launchctl(args: string[]) {
  return run("launchctl", args);
}

function installNpmAndBuild(target: string): void {
  const npmCi = spawnSync("npm", ["ci"], {
    cwd: target,
    stdio: "inherit",
    env: process.env,
  });
  if (npmCi.status !== 0) {
    const npmInstall = spawnSync("npm", ["install"], {
      cwd: target,
      stdio: "inherit",
      env: process.env,
    });
    if (npmInstall.status !== 0) {
      throw new Error(`npm ci/install failed in ${target}`);
    }
  }
  const build = spawnSync("npm", ["run", "build"], {
    cwd: target,
    stdio: "inherit",
    env: process.env,
  });
  if (build.status !== 0) {
    throw new Error(`next build failed in ${target}`);
  }
}

export function installLaunchAgent(): Record<string, unknown> {
  const cfg = loadConfig();
  const workdir = supportDir();
  copyRuntime(workdir);
  installNpmAndBuild(workdir);

  const plist = launchAgentPath();
  mkdirSync(path.dirname(plist), { recursive: true });
  writeFileSync(plist, plistBody(process.execPath, workdir), "utf8");

  const domain = `gui/${uid()}/${LAUNCH_AGENT_LABEL}`;
  launchctl(["bootout", domain]);
  let loaded = launchctl(["bootstrap", `gui/${uid()}`, plist]);
  if (!loaded.ok) {
    loaded = launchctl(["load", "-w", plist]);
  }
  launchctl(["enable", domain]);
  const kicked = launchctl(["kickstart", "-k", domain]);

  return {
    ok: loaded.ok || kicked.ok,
    plist,
    label: LAUNCH_AGENT_LABEL,
    bootstrap: (loaded.stderr || loaded.stdout || "").trim(),
    runtime: workdir,
    url: `http://${cfg.host}:${cfg.port}`,
  };
}

export function uninstallLaunchAgent(): Record<string, unknown> {
  const plist = launchAgentPath();
  const domain = `gui/${uid()}/${LAUNCH_AGENT_LABEL}`;
  launchctl(["bootout", domain]);
  launchctl(["unload", "-w", plist]);
  if (existsSync(plist)) {
    unlinkSync(plist);
  }
  return { ok: true, removed: plist };
}

function main(): void {
  const command = process.argv[2] || "install";
  if (command === "uninstall") {
    process.stdout.write(`${JSON.stringify(uninstallLaunchAgent(), null, 2)}\n`);
    return;
  }
  if (command !== "install") {
    console.error("Usage: tsx scripts/install-agent.ts [install|uninstall]");
    process.exit(2);
  }
  process.stdout.write(`${JSON.stringify(installLaunchAgent(), null, 2)}\n`);
}

main();
