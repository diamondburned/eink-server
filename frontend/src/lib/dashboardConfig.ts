import { readFile } from "fs/promises";
import { error, type RequestEvent } from "@sveltejs/kit";
import crypto from "crypto";

// loadDashboardConfig loads the config for a given dashboard ID from the
// dashboards/config.json file, automatically resolving any file references and
// checking the password if enabled.
export async function loadDashboardConfig<T extends object>(
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
    throw new Error(`Failed to resolve config`, { cause: err });
  });
  if (typeof resolved !== "object" || resolved === null) {
    throw new Error(`Expected config to be an object`);
  }

  // Automatically check for the dashboard's password field, if any.
  if (checkPassword && "password" in resolved) {
    const gotPassword = ev.url.searchParams.get("password");
    if (!(await checkDashboardPassword(resolved.password, gotPassword))) {
      error(401, "Wrong dashboard password");
    }
  }

  return resolved;
}

async function resolveConfigValue(value: unknown): Promise<any> {
  if (valueIsSpecialObject(value)) {
    if (value._file === undefined) {
      if (value._default === undefined) {
        throw new Error(`Config value must have either _file or _default`);
      }
      return value._default;
    }

    return await readFile(value._file, "utf-8")
      .then((t) => t.trim())
      .catch((err) => {
        if (value._default === undefined) {
          throw new Error(`Failed to read file ${value._file}`, { cause: err });
        }
        return value._default;
      });
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
            throw new Error(`Error at key ${k}:`, {
              cause: err,
            });
          }),
        ]),
      ),
    );
  }

  return value; // Not a special config object, return as-is.
}

function valueIsSpecialObject(value: any): value is { _file?: string; _default?: any } {
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
