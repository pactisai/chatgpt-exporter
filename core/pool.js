import { chromium } from "playwright";

const BROWSER_OPTS = {
  headless: true,
  args: [
    "--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox",
    "--disable-setuid-sandbox", "--disable-extensions",
    "--disable-background-networking", "--disable-sync", "--no-first-run",
  ],
};

let _browser = null;
let _openPages = 0;
let _launchPromise = null;

async function ensureBrowser() {
  if (_browser) return _browser;
  if (!_launchPromise) {
    _launchPromise = chromium.launch(BROWSER_OPTS).then((b) => {
      _browser = b;
      console.log("[pool] Browser launched");
    }).finally(() => {
      _launchPromise = null;
    });
  }
  await _launchPromise;
  return _browser;
}

export async function getPage() {
  const browser = await ensureBrowser();
  _openPages++;
  return browser.newPage();
}

export async function releasePage(page) {
  try {
    await page.close();
  } catch (e) {
    console.warn("[pool] Page close error:", e.message);
  }
  _openPages--;
}

export async function warmPool() {
  await ensureBrowser();
}

export async function closePool() {
  if (_browser && _openPages <= 0) {
    try {
      await _browser.close();
    } catch (e) {
      console.warn("[pool] Browser close error:", e.message);
    }
    _browser = null;
    console.log("[pool] Closed");
  }
}
