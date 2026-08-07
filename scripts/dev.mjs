import { spawn } from "node:child_process";

const forwardedArgs = process.argv.slice(2);

function resolvePort(args) {
  const explicit = args.find((arg) => arg.startsWith("--port="));
  if (explicit) return explicit.slice("--port=".length);
  const index = args.findIndex((arg) => arg === "--port" || arg === "-p");
  return index >= 0 && args[index + 1]
    ? args[index + 1]
    : process.env.PORT || "3000";
}

const port = resolvePort(forwardedArgs);
const nextArgs = forwardedArgs.some(
  (arg) => arg === "--port" || arg === "-p" || arg.startsWith("--port="),
)
  ? forwardedArgs
  : ["--port", port, ...forwardedArgs];
const environment = { ...process.env, INNGEST_DEV: "1" };
const children = new Set();
let shuttingDown = false;

function start(command, args, label) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;
    console.error(
      `[dev] ${label} stopped${signal ? ` (${signal})` : ` with code ${code ?? 1}`}.`,
    );
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  const forceTimer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5_000);
  forceTimer.unref();
  Promise.allSettled(
    [...children].map(
      (child) => new Promise((resolve) => child.once("exit", resolve)),
    ),
  ).finally(() => process.exit(exitCode));
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

console.log(
  `[dev] Starting Next.js on http://localhost:${port} and Inngest on http://localhost:8288`,
);

start(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...nextArgs],
  "Next.js",
);
start(
  npxCommand,
  [
    "--yes",
    "--ignore-scripts=false",
    "inngest-cli@latest",
    "dev",
    "--no-discovery",
    "-u",
    `http://localhost:${port}/api/inngest`,
  ],
  "Inngest Dev Server",
);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
