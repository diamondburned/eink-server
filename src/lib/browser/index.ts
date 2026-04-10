import type { Browser } from "puppeteer-core";
import { getBrowser as getChromiumBrowser } from "./chromium";
import { getBrowser as getFirefoxBrowser } from "./firefox";

export { getChromiumBrowser, getFirefoxBrowser, type Browser };

let warnedAboutEnv = false;

export function getBrowser(): Promise<
  Browser & {
    firefox?: true;
  }
> {
  switch (process.env.EINK_BROWSER) {
    case "firefox":
      return getFirefoxBrowser();
    case "chromium":
    case "chrome":
      return getChromiumBrowser();
    case undefined:
      if (!warnedAboutEnv) {
        console.info("No EINK_BROWSER specified, defaulting to Firefox");
        warnedAboutEnv = true;
      }
      return getFirefoxBrowser();
    default:
      throw new Error(`Unsupported EINK_BROWSER value: ${process.env.EINK_BROWSER}`);
  }
}
