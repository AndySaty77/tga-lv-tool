/**
 * Serverseitige HTML-zu-PDF-Erzeugung mit Puppeteer.
 * Zwei Modi: Lokal (NODE_ENV !== "production") nutzt Chrome/Env, Production nutzt @sparticuz/chromium.
 */

import { existsSync } from "fs";
import { platform } from "os";
import puppeteer from "puppeteer-core";

const DARWIN_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const LOG = (msg: string) => console.error("[pdfEngine]", msg);

export type PdfEngineOptions = {
  html: string;
  footer?: boolean;
};

const isProduction = process.env.NODE_ENV === "production";

/**
 * Lokaler Modus: executablePath aus Env oder lokalem Chrome (macOS). Kein @sparticuz/chromium.
 */
function getLocalExecutablePath(): { path: string; source: "PUPPETEER_EXECUTABLE_PATH" | "localChrome" } | null {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (envPath) {
    return { path: envPath, source: "PUPPETEER_EXECUTABLE_PATH" };
  }
  if (platform() === "darwin" && existsSync(DARWIN_CHROME)) {
    return { path: DARWIN_CHROME, source: "localChrome" };
  }
  return null;
}

/**
 * Production-Modus: executablePath und Launch-Args aus @sparticuz/chromium.
 */
async function getProductionExecutablePath(): Promise<{ path: string; args: string[] }> {
  const chromium = await import("@sparticuz/chromium");
  const path = await chromium.default.executablePath();
  const args = chromium.default.args;
  return { path, args };
}

export async function htmlToPdfBuffer(options: PdfEngineOptions): Promise<Buffer> {
  const { html } = options;

  let executablePath: string;
  let launchArgs: string[];

  if (isProduction) {
    LOG("mode: production (Vercel/serverless)");
    const prod = await getProductionExecutablePath();
    executablePath = prod.path;
    launchArgs = prod.args;
    LOG("executablePath: " + executablePath + " (sparticuz/chromium)");
  } else {
    LOG("mode: local (non-production)");
    const local = getLocalExecutablePath();
    if (!local) {
      throw new Error(
        "Lokale PDF-Erzeugung benötigt Google Chrome oder PUPPETEER_EXECUTABLE_PATH. " +
          "macOS: Chrome installieren oder PUPPETEER_EXECUTABLE_PATH setzen."
      );
    }
    executablePath = local.path;
    launchArgs = platform() === "darwin" && executablePath === DARWIN_CHROME
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    LOG("executablePath: " + executablePath + " (" + local.source + ")");
  }

  LOG("launch: headless=true executablePath=" + executablePath + " argsCount=" + launchArgs.length);

  LOG("before browser launch");
  const browser = await puppeteer.launch({
    args: launchArgs,
    defaultViewport: null,
    executablePath,
    headless: true,
  });
  LOG("after browser launch");

  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

  try {
    LOG("before page create");
    page = await browser.newPage();
    LOG("after page create");

    LOG("before setViewport");
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    LOG("after setViewport");

    LOG("before setContent");
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    LOG("after setContent");

    await new Promise((r) => setTimeout(r, 100));
    LOG("before page.pdf");

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    LOG("after page.pdf");

    return Buffer.from(buffer);
  } finally {
    LOG("before close");
    if (page) {
      try {
        await page.close();
      } catch (e) {
        LOG("page.close error: " + (e instanceof Error ? e.message : String(e)));
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        LOG("browser.close error: " + (e instanceof Error ? e.message : String(e)));
      }
    }
    LOG("after close");
  }
}
