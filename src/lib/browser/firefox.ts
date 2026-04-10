import puppeteer, { type Browser } from "puppeteer-core";
import { exec as execCallback } from "child_process";
import { env } from "$env/dynamic/private";
import util from "util";
import * as path from "path";
import { tmpdir } from "os";
import { mkdir } from "fs/promises";

const exec = util.promisify(execCallback);

// How long (ms) to keep the browser process alive after the last page closes.
// After this idle period the browser is shut down and the next request will
// launch a fresh one.
const idleCloseDelayMs = 30_000;

const dpi = process.env.EINK_FIREFOX_DPI ? parseInt(process.env.EINK_FIREFOX_DPI) : 96;
const scaleFactor = process.env.EINK_FIREFOX_SCALE ? parseFloat(process.env.EINK_FIREFOX_SCALE) : 1;

type FirefoxBrowser = Browser & {
  firefox: true;
};

let sharedBrowser: FirefoxBrowser | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

export async function getBrowser(): Promise<FirefoxBrowser> {
  if (sharedBrowser && sharedBrowser.connected) {
    // Reset the idle-close timer on every use.
    resetIdleTimer();
    return sharedBrowser;
  }

  // Use a dedicated Firefox profile directory to avoid conflicts with any
  // regular Firefox profiles the user may have.
  const profileDir = path.join(
    env.EINK_SERVER_DIR || `${tmpdir()}/eink-server`,
    "firefox-user-data",
  );
  await mkdir(profileDir, { recursive: true });

  const executablePath = await firefoxExecPath();
  const browser = await puppeteer
    .launch({
      browser: "firefox",
      executablePath,
      headless: true,
      env: {
        // Kill off X11 and Wayland display backends to avoid issues.
        DISPLAY: "",
        WAYLAND_DISPLAY: "",
      },
      args: [
        "--no-first-run",
        "--no-remote",
        "--new-instance",
        `--force-device-scale-factor=${scaleFactor}`,
        "--window-size=1920,1080",
        `--profile=${profileDir}`,
        "--private-window",
        "--purgecaches",
      ],
      extraPrefsFirefox: {
        // https://wiki.archlinux.org/title/Firefox/Tweaks#Configure_the_DPI_value
        "layout.css.dpi": dpi,
        "layout.css.devPixelsPerPx": dpi / 96,
        "font.size.systemFontScale": dpi,
        "browser.display.os-zoom-behavior": 0,
        "ui.textScaleFactor": (dpi / 96) * 100,
        // Disable font antialiasing by default, since we're rendering on a
        // display with 1-bit color depth.
        "gfx.text.disable-aa": true,
        "gfx.text.subpixel-position.force-disabled": true,
        "gfx.font_rendering.graphite.enabled": false,
        "gfx.font_rendering.opentype_svg.enabled": false,
        // https://www.reddit.com/r/firefox/comments/7c7sb4/how_to_get_nice_nonantialiased_font_rendering/
        "browser.display.auto_quality_min_font_size": 1,
        "layout.css.font-variations.enabled": false,
      },
    })
    .catch((err) => {
      throw new Error(`Failed to launch Firefox at '${executablePath}': ${err}`, { cause: err });
    });

  sharedBrowser = browser as FirefoxBrowser;
  sharedBrowser.firefox = true;

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

async function firefoxExecPath(): Promise<string> {
  if (env.FIREFOX_EXECUTABLE) {
    return env.FIREFOX_EXECUTABLE;
  }

  for (const name of ["firefox", "firefox-esr", "firefox-bin"]) {
    try {
      // TODO: this doesn't work if the env doesn't have which.
      // Maybe fix.
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
    "No Firefox executable found. Please set FIREFOX_EXECUTABLE environment variable to the path of a Firefox binary.",
  );
}
