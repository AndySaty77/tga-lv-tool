import { NextResponse } from "next/server";
import { analyzeLvText, DbTrigger } from "../../../lib/analyzeLvText";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const lvText = String(body?.lvText ?? "");
  const trigger = body?.trigger as DbTrigger | undefined;

  if (!trigger) {
    return NextResponse.json({ error: "No trigger provided" }, { status: 400 });
  }

  const findings = analyzeLvText(lvText, [trigger]);

  return NextResponse.json({
    findings,
    hit: findings.length > 0,
  });
}
