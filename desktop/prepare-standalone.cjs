const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

function findServerDir(dir) {
  if (fs.existsSync(path.join(dir, "server.js"))) return dir;
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(dir, entry.name);
    if (fs.existsSync(path.join(nested, "server.js"))) return nested;
  }
  return null;
}

const serverDir = findServerDir(standalone);
if (!serverDir) {
  console.error("Missing .next/standalone/server.js. Run next build first.");
  process.exit(1);
}

copyDir(staticSrc, path.join(serverDir, ".next", "static"));
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, path.join(serverDir, "public"));
}
for (const name of ["config.yaml", "data", "drizzle"]) {
  const from = path.join(root, name);
  const to = path.join(serverDir, name);
  if (fs.existsSync(from)) copyDir(from, to);
}

console.log("Standalone app resources are ready.");
