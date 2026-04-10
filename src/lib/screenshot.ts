import sharp from "sharp";
import { stat, readFile, writeFile, mkdir } from "fs/promises";
import { env } from "$env/dynamic/private";
import { join } from "path";
import { tmpdir } from "os";
import { ditherPNG } from "./dither.js";
import { getBrowser } from "./chromium.js";
import { hash } from "crypto";
import type { BaseDashboardConfig } from "./config.js";

// ScreenshotResult is returned by takeScreenshot. It always contains the PNG
// data along with metadata about whether the result came from the on-disk
// cache or was freshly captured.
export interface ScreenshotResult {
  // The PNG image as a Buffer.
  data: Buffer;
  // true if the screenshot was just captured, false if it was served from the
  // on-disk cache.
  fresh: boolean;
  // When the screenshot currently in the cache was taken. For a fresh capture
  // this is the current time; for a cached result it is the mtime of the
  // cache file.
  lastTaken: Date;
}

// screenshotsDir returns the directory where cached screenshots are stored.
function screenshotsDir(): string {
  return env.EINK_SERVER_DIR || `${tmpdir()}/eink-server`;
}

// screenshotPathFor returns the path where the cached PNG for the given
// dashboard ID is stored.
function screenshotPathFor(dashboardID: string, config: BaseDashboardConfig): string {
  const cfgBit = hash("sha256", JSON.stringify(config), "hex").slice(0, 8);
  return join(screenshotsDir(), `${dashboardID}-${cfgBit}.png`);
}

// takeScreenshot opens the given URL in a headless Chromium page, applies any
// configured CSS, waits for the content to settle, and returns a ScreenshotResult.
//
// When config.screenshot.maxAge is set the function will:
//   1. Look for a cached PNG at {TMP}/eink-server/{dashboardID}.png.
//   2. If the file exists and is younger than maxAge milliseconds (and force is
//      not true), return the cached bytes with fresh = false.
//   3. Otherwise capture a new screenshot, write it to the cache file, and
//      return the new bytes with fresh = true.
//
// When maxAge is not set (or dashboardID is not provided) a fresh screenshot
// is always captured and no cache file is written.
export async function takeScreenshot(
  id: string,
  url: string,
  config: BaseDashboardConfig,
  {
    force,
  }: {
    // When true, bypass the cache and always capture a fresh screenshot (but
    // still update the cache file when maxAge is configured).
    force?: boolean;
  } = {},
): Promise<ScreenshotResult> {
  if (!config.screenshot) {
    throw new Error(`screenshot config is required`);
  }

  const { width, height, screenshot, password } = config;
  const now = Date.now();

  if (screenshot.cachedDurationSec && !force) {
    const cachePath = screenshotPathFor(id, config);
    try {
      const fileStat = await stat(cachePath);
      const ageMs = now - fileStat.mtimeMs;
      if (ageMs < screenshot.cachedDurationSec * 1000) {
        return {
          data: await readFile(cachePath),
          fresh: false,
          lastTaken: fileStat.mtime,
        };
      }
    } catch {
      // Cache miss (file absent or unreadable) — fall through to capture.
    }
  }

  const targetURL = new URL(url);
  if (password) {
    targetURL.searchParams.set("password", password);
  }

  const browser = await getBrowser();

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: screenshot.imageScale ?? 1,
  });

  let png: Buffer | undefined;
  try {
    await page.goto(targetURL.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });

    await page.waitForSelector("body", { state: "visible" });

    if (screenshot.pageLoadDelaySec) {
      const delayMs = screenshot.pageLoadDelaySec * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
      scale: screenshot.imageScale ? "device" : "css",
      style: [
        screenshot.cssFilter ? `body { filter: ${screenshot.cssFilter}; }` : "",
        screenshot.cssExtras ?? "",
      ].join("\n"),
      animations: "disabled",
    });
  } finally {
    await page.close();
  }

  if ((screenshot.imageScale ?? 1) != 1) {
    png = await sharp(png)
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
  } else {
    png = Buffer.from(png);
  }

  if (screenshot.dithering) {
    png = await ditherPNG(png, screenshot.dithering);
  }

  if (screenshot.cachedDurationSec) {
    const cachePath = screenshotPathFor(id, config);
    try {
      await mkdir(screenshotsDir(), { recursive: true });
      await writeFile(cachePath, png);
    } catch (err) {
      // A cache write failure is non-fatal; the caller still gets the data.
      console.error(`Failed to write screenshot cache to ${cachePath}:`, err);
    }
  }

  return {
    data: png,
    fresh: true,
    lastTaken: new Date(now),
  };
}
