/**
 * Serverseitige HTML-zu-PDF-Erzeugung mit Puppeteer.
 * Minimaler, stabiler Ablauf: eine Page, setContent(domcontentloaded), pdf(), sauber schließen.
 *
 * macOS: Es wird immer der systemseitig installierte Google Chrome verwendet, sofern vorhanden.
 * Andere Plattformen / Vercel: @sparticuz/chromium.
 */

import { existsSync } from "fs";
import { platform } from "os";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const DARWIN_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const LOG = (msg: string) => console.error("[pdfEngine]", msg);

export type PdfEngineOptions = {
  html: string;
  footer?: boolean;
};

/**
 * Bestimmt executablePath: Auf macOS fest System-Chrome, sofern vorhanden; sonst Fallback (Env / Chromium).
 */
function getExecutablePath(): string {
  const isDarwin = platform() === "darwin";

  if (isDarwin && existsSync(DARWIN_CHROME)) {
    return DARWIN_CHROME;
  }

  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    return envPath;
  }

  return "";
}

/**
 * Erzeugt aus dem übergebenen HTML ein PDF-Buffer.
 * Stabiler Ablauf: Browser starten → eine Page → Viewport → setContent(domcontentloaded) → pdf() → close.
 * Kein networkidle, kein goto, keine Header/Footer (vermeidet Frame-Detach-Probleme).
 */
export async function htmlToPdfBuffer(options: PdfEngineOptions): Promise<Buffer> {
  const { html } = options;

  let executablePath = getExecutablePath();
  if (!executablePath) {
    try {
      executablePath = await chromium.executablePath();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Chromium executablePath: ${msg}. Lokal Mac: Google Chrome installieren oder PUPPETEER_EXECUTABLE_PATH setzen.`);
    }
  }

  LOG("executablePath: " + executablePath);

  const isDarwinChrome = platform() === "darwin" && executablePath === DARWIN_CHROME;
  const launchArgs = isDarwinChrome ? ["--no-sandbox", "--disable-setuid-sandbox"] : chromium.args;

  const launchConfig = {
    headless: true,
    executablePath,
    argsCount: launchArgs.length,
  };
  LOG("launch config: headless=" + launchConfig.headless + " executablePath=" + executablePath + " argsCount=" + launchConfig.argsCount);

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
