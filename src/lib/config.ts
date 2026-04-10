import { readFile } from "fs/promises";
import { error, type RequestEvent } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import crypto from "crypto";

// BaseDashboardConfig defines the minimal shape that every dashboard config
// must satisfy. Both the page renderer (+page.server.ts) and the screenshot
// endpoint ([id]/screenshot.png/+server.ts) use a subset of this type.
export interface BaseDashboardConfig {
  width: number;
  height: number;
  password: string | null;
  screenshot?: ScreenshotConfig;
  [key: string]: unknown; // Allow arbitrary extra fields for dashboard-specific config.
}

// ScreenshotConfig holds all parameters that control how the screenshot
// endpoint captures and post-processes a dashboard image.
export interface ScreenshotConfig {
  // Seconds to wait after the body is visible before capturing.
  pageLoadDelaySec?: number;
  // Maximum age of a cached screenshot in seconds. When set, takeScreenshot
  // will serve a cached file from disk if it is younger than maxAge, and only
  // re-capture when the cache is stale (or when force is true).
  cachedDurationSec?: number;
  // CSS filter string applied to <body> (e.g. "grayscale(1)").
  cssFilter?: string;
  // Additional raw CSS injected into <head> before capture.
  cssExtras?: string;
  // Viewport upscale factor — captured at (width * imageScale) x (height *
  // imageScale), then downscaled back before dithering. Values > 1 reduce
  // aliasing on thin lines.
  imageScale?: number;
  // Optional dithering applied after any rescaling.
  dithering?: DitheringConfig;
}

export interface DitheringConfig {
  // "floyd-steinberg" for error-diffusion dithering, "none" for nearest-color
  // quantization only.
  algorithm: "floyd-steinberg" | "none";
  // Number of grayscale levels in the output palette (2–256).
  colors: number;
}

// loadDashboardConfig loads the config for a given dashboard ID from the
// dashboards/config.json file, automatically resolving any file references and
// checking the password if enabled.
export async function loadDashboardConfig<T extends BaseDashboardConfig = BaseDashboardConfig>(
  ev: RequestEvent,
  config: Record<string, unknown>,
  {
    checkPassword = true,
  }: {
    checkPassword?: boolean;
  } = {},
): Promise<T> {
  // Load all entries concurrently!
  const resolved = await resolveConfigValue(config).catch((err) => {
    throw new Error(`Failed to resolve config: ${err}`, { cause: err });
  });
  if (typeof resolved !== "object" || resolved === null) {
    throw new Error(`Expected config to be an object`);
  }

  // Automatically check for the dashboard's password field, if any.
  if (checkPassword && resolved.password) {
    const gotPassword = ev.url.searchParams.get("password");
    if (!(await checkDashboardPassword(resolved.password, gotPassword))) {
      error(401, "Wrong dashboard password");
    }
  }

  return resolved;
}

async function resolveConfigValue(value: unknown): Promise<any> {
  if (valueIsSpecialObject(value)) {
    if (value._file) {
      const file = await readFile(value._file, "utf-8")
        .then((t) => t.trim())
        .catch((err) => {
          if (err.code !== "ENOENT") {
            console.warn(`Ignoring error while reading config file ${value._file}: ${err}`);
          }
          return undefined;
        });
      if (file !== undefined) {
        return file;
      }
    }

    if (value._env) {
      const envValue = env[value._env];
      if (envValue !== undefined) {
        return envValue;
      }
    }

    if (value._default !== undefined) {
      return value._default;
    }

    throw new Error(`Invalid config object: ${JSON.stringify(value)}`);
  }

  if (typeof value === "object") {
    // Recursively resolve arrays:
    if (Array.isArray(value)) {
      return await Promise.all(value.map((v) => resolveConfigValue(v)));
    }

    if (value === null) {
      return null;
    }

    // Recursively resolve nested objects:
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([k, v]) => [
          k,
          await resolveConfigValue(v).catch((err) => {
            throw new Error(`Error at key ${k}: ${err}`, {
              cause: err,
            });
          }),
        ]),
      ),
    );
  }

  return value; // Not a special config object, return as-is.
}

function valueIsSpecialObject(value: any): value is {
  _file?: string;
  _env?: string;
  _default?: any;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).every((key) => key.startsWith("_"))
  );
}

async function checkDashboardPassword(
  wantPassword: string | null,
  gotPassword: string | null,
): Promise<boolean> {
  // If config password is null or empty, no password required
  if (wantPassword === null || wantPassword === "") {
    return true;
  }

  return (
    !!gotPassword && crypto.timingSafeEqual(Buffer.from(wantPassword), Buffer.from(gotPassword))
  );
}
