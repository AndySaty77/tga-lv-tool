/**
 * GAEB-Parse-Testbibliothek: prüft parse() gegen Sollwerte.
 * Run: npm run test:gaeb-parse
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../../lib/gaebParse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");
const EXPECTED_PATH = path.join(__dirname, "expected.json");

function containsAny(text: string, arr: string[]): boolean {
  if (!arr || arr.length === 0) return true;
  const t = (text ?? "").toLowerCase();
  return arr.some((s) => t.includes(String(s).toLowerCase()));
}

async function run() {
  const expected: Record<
    string,
    {
      formatDetected?: string;
      parserUsed?: string;
      itemCountMin?: number;
      itemCountMax?: number;
      structureConfidenceMin?: number;
      prefaceContains?: string[];
      prefaceMinLength?: number;
    }
  > = JSON.parse(fs.readFileSync(EXPECTED_PATH, "utf8"));

  const files = fs.readdirSync(FIXTURES).filter((f) => !f.startsWith("."));
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(FIXTURES, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const exp = expected[file] || {};

    const result = parse(raw, { filename: file });

    const checks: string[] = [];

    if (exp.formatDetected && result.formatDetected !== exp.formatDetected) {
      checks.push(`formatDetected: ${result.formatDetected} (erwartet: ${exp.formatDetected})`);
    }
    if (exp.parserUsed && result.parserUsed !== exp.parserUsed) {
      checks.push(`parserUsed: ${result.parserUsed} (erwartet: ${exp.parserUsed})`);
    }
    if (exp.itemCountMin !== undefined && result.itemCount < exp.itemCountMin) {
      checks.push(`itemCount: ${result.itemCount} < ${exp.itemCountMin}`);
    }
    if (exp.itemCountMax !== undefined && result.itemCount > exp.itemCountMax) {
      checks.push(`itemCount: ${result.itemCount} > ${exp.itemCountMax}`);
    }
    if (exp.structureConfidenceMin !== undefined && result.structureConfidence < exp.structureConfidenceMin) {
      checks.push(`structureConfidence: ${result.structureConfidence} < ${exp.structureConfidenceMin}`);
    }
    if (exp.prefaceContains?.length && !containsAny(result.prefaceText, exp.prefaceContains)) {
      checks.push(`prefaceText enthält keins von: ${exp.prefaceContains.join(", ")}`);
    }
    if (exp.prefaceMinLength !== undefined && result.prefaceText.length < exp.prefaceMinLength) {
      checks.push(`prefaceText.length: ${result.prefaceText.length} < ${exp.prefaceMinLength}`);
    }

    if (checks.length > 0) {
      failed++;
      console.error(`\n[FAIL] ${file}`);
      checks.forEach((c) => console.error("  -", c));
      console.error("  Debug:", {
        parserUsed: result.parserUsed,
        formatDetected: result.formatDetected,
        itemCount: result.itemCount,
        structureConfidence: result.structureConfidence,
        prefaceLen: result.prefaceText.length,
        warnings: result.warnings,
      });
    } else {
      console.log(
        `[OK] ${file} | parser=${result.parserUsed} format=${result.formatDetected} items=${result.itemCount} conf=${result.structureConfidence.toFixed(2)}`
      );
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} von ${files.length} Tests fehlgeschlagen.`);
    process.exit(1);
  }
  console.log(`\nAlle ${files.length} Tests bestanden.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
