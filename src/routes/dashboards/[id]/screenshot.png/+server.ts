import { error } from "@sveltejs/kit";
import { takeScreenshot } from "$lib/screenshot";
import { loadDashboardConfig } from "$lib/config";
import type { RequestHandler } from "./$types";

// All dashboard config.json files are statically imported at build time via
// Vite's import.meta.glob. This means no dynamic filesystem access is needed
// at request time — Vite bundles the raw JSON objects into the server build.
const configs = import.meta.glob("/src/routes/dashboards/*/config.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

export const GET: RequestHandler = async (ev) => {
  const { id } = ev.params;
  const force = ["1", "true"].includes(ev.url.searchParams.get("force") ?? "");

  // Resolve the config for this dashboard ID.
  const raw = configs[`/src/routes/dashboards/${id}/config.json`];
  if (!raw) {
    error(404, `Dashboard '${id}' not found`);
  }

  const config = await loadDashboardConfig(ev, raw);
  const pageURL = new URL(`/dashboards/${id}`, ev.url.origin).toString();

  // Capture the page as a PNG buffer (using the cache when maxAge is set).
  const screenshot = await takeScreenshot(id, pageURL, config, { force });

  const cacheHeaders = {
    ETag: `W/"${screenshot.data.length}-${screenshot.lastTaken.getTime()}"`,
    "Last-Modified": screenshot.lastTaken.toUTCString(),
    "Cache-Control": "public, must-revalidate",
  };

  if (
    ev.request.headers.get("If-None-Match") === cacheHeaders["ETag"] ||
    ev.request.headers.get("If-Modified-Since") === cacheHeaders["Last-Modified"]
  ) {
    return new Response(null, {
      status: 304,
      headers: { ...cacheHeaders },
    });
  }

  return new Response(new Uint8Array(screenshot.data), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": screenshot.data.length.toString(),
      ...cacheHeaders,
    },
  });
};
