/**
 * Debug-Hook: Schreibt das Mock-Report-HTML nach public/debug-pdf-report.html.
 * Ausführen: npx tsx lib/pdf/writeDebugHtml.ts
 * Dann im Browser: http://localhost:3000/debug-pdf-report.html (während dev server läuft)
 * oder public/debug-pdf-report.html direkt im Browser öffnen.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { renderPdfHtmlFromMock } from "./renderPdfHtml";

const base = process.cwd();
const html = renderPdfHtmlFromMock();
const outPath = join(base, "public", "debug-pdf-report.html");
writeFileSync(outPath, html, "utf8");
console.log("Written:", outPath);
