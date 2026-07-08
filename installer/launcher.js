// Storyroom native Windows launcher.
//
// Started by the bundled node.exe (see start-storyroom.vbs). Boots the Next.js
// standalone server and the Hocuspocus realtime server as child processes,
// waits until the web app answers, then opens the default browser. Stays
// resident as the parent of both servers so "Stop Storyroom" can end the whole
// tree with one taskkill.
//
// Layout expected next to this file:
//   node\node.exe        bundled runtime (also what is executing this script)
//   app\server.js        Next.js standalone server
//   realtime\realtime.cjs  bundled Hocuspocus server
"use strict";

const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const WEB_PORT = Number(process.env.STORYROOM_WEB_PORT ?? 3000);
const COLLAB_PORT = Number(process.env.STORYROOM_COLLAB_PORT ?? 1234);

const appRoot = __dirname;
const dataRoot = path.join(
  process.env.LOCALAPPDATA ?? path.join(appRoot, "userdata"),
  "Storyroom",
);
const dataDir = path.join(dataRoot, "data");
const logDir = path.join(dataRoot, "logs");
const pidFile = path.join(dataRoot, "storyroom.pid.json");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

function webIsUp() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: WEB_PORT, path: "/", timeout: 2000 },
      (res) => {
        res.resume();
        resolve(true);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openBrowser() {
  execFile("cmd.exe", ["/c", "start", "", `http://localhost:${WEB_PORT}`], {
    windowsHide: true,
  });
}

function logStream(name) {
  return fs.createWriteStream(path.join(logDir, name), { flags: "a" });
}

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
  try {
    fs.unlinkSync(pidFile);
  } catch {}
  process.exit(code);
}

function startServer(name, script, cwd, extraEnv) {
  const out = logStream(`${name}.log`);
  const child = spawn(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      STORYROOM_DATA_DIR: dataDir,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      out.write(`[launcher] ${name} exited with code ${code}; stopping Storyroom.\n`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

async function main() {
  // Already running? Just bring up a browser tab.
  if (await webIsUp()) {
    openBrowser();
    process.exit(0);
  }

  const realtime = startServer(
    "realtime",
    path.join(appRoot, "realtime", "realtime.cjs"),
    path.join(appRoot, "realtime"),
    { COLLAB_PORT: String(COLLAB_PORT) },
  );

  const web = startServer(
    "web",
    path.join(appRoot, "app", "server.js"),
    path.join(appRoot, "app"),
    { PORT: String(WEB_PORT), HOSTNAME: "127.0.0.1" },
  );

  fs.writeFileSync(
    pidFile,
    JSON.stringify(
      { launcher: process.pid, web: web.pid, realtime: realtime.pid },
      null,
      2,
    ),
  );

  // Wait up to 60s for the web server, then open the browser.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await webIsUp()) {
      openBrowser();
      return; // stay resident as the parent of both servers
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  shutdown(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main();
