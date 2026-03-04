/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.SCORE_BASE_URL || "http://localhost:3000";
const FIXTURES_DIR = "lib/scoreFixtures";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function inRange(x, min, max) {
  return typeof x === "number" && x >= min && x <= max;
}

async function run() {
  const dir = path.resolve(process.cwd(), FIXTURES_DIR);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  if (!files.length) {
    console.log("No fixtures found. Skipping.");
    return;
  }

  let failed = 0;

  for (const file of files) {
    const fx = readJson(path.join(dir, file));
    const name = fx.name || file;

    const res = await fetch(`${BASE_URL}/api/score?debug=1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lvText: fx.lvText }),
    });

    if (!res.ok) {
      failed++;
      console.error(`[${name}] HTTP ${res.status}`);
      continue;
    }

    const json = await res.json();

    const total = json.total;
    const expTotal = fx.expect?.totalRange;

    if (expTotal && !inRange(total, expTotal[0], expTotal[1])) {
      failed++;
      console.error(`[${name}] total=${total} OUTSIDE range ${expTotal[0]}..${expTotal[1]}`);
    } else {
      console.log(`[${name}] total=${total} OK`);
    }

    const per = json.perCategory || {};
    const expPer = fx.expect?.perCategoryRanges || {};
    for (const [k, r] of Object.entries(expPer)) {
      const v = per[k];
      if (!inRange(v, r[0], r[1])) {
        failed++;
        console.error(`[${name}] ${k}=${v} OUTSIDE range ${r[0]}..${r[1]}`);
      }
    }
  }

  if (failed) {
    console.error(`Regression failed: ${failed} checks`);
    process.exit(1);
  }

  console.log("Regression OK");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
