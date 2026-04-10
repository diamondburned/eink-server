import puppeteer, { type Browser } from "puppeteer-core";
import { exec as execCallback } from "child_process";
import { env } from "$env/dynamic/private";
import util from "util";

const exec = util.promisify(execCallback);

// How long (ms) to keep the browser process alive after the last page closes.
// After this idle period the browser is shut down and the next request will
// launch a fresh one.
const idleCloseDelayMs = 30_000;

let sharedBrowser: Browser | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.connected) {
    // Reset the idle-close timer on every use.
    resetIdleTimer();
    return sharedBrowser;
  }

  const executablePath = await chromiumExecPath();
  sharedBrowser = await puppeteer
    .launch({
      executablePath,
      headless: true,
      env: {
        // Kill off X11 and Wayland display backends to avoid issues.
        DISPLAY: "",
        WAYLAND_DISPLAY: "",
      },
      args: [
        "--bwsi",
        "--incognito",
        "--no-first-run",
        "--noerrdialogs",
        "--hide-scrollbars",
        "--disable-sync",
        "--disable-notifications",
        "--disable-extensions",
        "--disable-default-apps",
        "--disable-translate",
        "--disable-background-networking",
        "--disable-dev-shm-usage",
        "--disable-font-subpixel-positioning",
        "--no-sandbox",
      ],
    })
    .catch((err) => {
      throw new Error(`Failed to launch Chromium at '${executablePath}'`, { cause: err });
    });

  sharedBrowser.on("disconnected", () => {
    sharedBrowser = null;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  });

  resetIdleTimer();
  return sharedBrowser;
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
      sharedBrowser = null;
    }
    idleTimer = null;
  }, idleCloseDelayMs);
}

// findChromium searches common locations for a Chromium/Chrome binary,
// mirroring the lookup order in the Go server's puppeteer package.
async function chromiumExecPath(): Promise<string> {
  if (env.CHROMIUM_EXECUTABLE) {
    return env.CHROMIUM_EXECUTABLE;
  }

  for (const name of ["chromium", "google-chrome", "chromium-browser", "chrome"]) {
    try {
      const which = await exec(`which ${name}`);
      const path = which.stdout.trim();
      if (path) {
        return path;
      }
    } catch {
      // not found, try next
    }
  }

  throw new Error(
    "No Chromium executable found. Please set CHROMIUM_EXECUTABLE environment variable to the path of a Chromium or Chrome binary.",
  );
}
