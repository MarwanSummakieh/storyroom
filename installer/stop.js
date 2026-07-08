// Stops a running Storyroom instance started by launcher.js.
// Kills the launcher's whole process tree via the PID file it wrote.
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const dataRoot = path.join(
  process.env.LOCALAPPDATA ?? path.join(__dirname, "userdata"),
  "Storyroom",
);
const pidFile = path.join(dataRoot, "storyroom.pid.json");

let pids;
try {
  pids = JSON.parse(fs.readFileSync(pidFile, "utf8"));
} catch {
  process.exit(0); // nothing recorded as running
}

for (const pid of [pids.launcher, pids.web, pids.realtime]) {
  if (!pid) continue;
  try {
    execFileSync("taskkill.exe", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    // already gone
  }
}

try {
  fs.unlinkSync(pidFile);
} catch {}
