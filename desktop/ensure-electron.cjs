const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const electronDir = path.join(__dirname, "..", "node_modules", "electron");
const installJs = path.join(electronDir, "install.js");
const pathTxt = path.join(electronDir, "path.txt");
const binary = path.join(
  electronDir,
  "dist",
  "Electron.app",
  "Contents",
  "MacOS",
  "Electron",
);

if (fs.existsSync(binary) && fs.existsSync(pathTxt)) process.exit(0);
if (!fs.existsSync(installJs)) {
  console.error("Electron is not installed. Run npm install.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [installJs], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
if (!fs.existsSync(binary)) {
  console.error("Electron downloaded but the Mac binary is missing.");
  process.exit(1);
}
if (!fs.existsSync(pathTxt)) {
  fs.writeFileSync(pathTxt, "Electron.app/Contents/MacOS/Electron");
}
