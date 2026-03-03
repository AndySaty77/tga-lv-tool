import { NextResponse } from "next/server";
import { analyzeLvText } from "@/lib/analyzeLvText";
import { computeScore } from "@/lib/scoring";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lvText = String(body?.lvText ?? "");

  const findings = analyzeLvText(lvText);
  const result = computeScore({ findings });

  return NextResponse.json(result);
}
