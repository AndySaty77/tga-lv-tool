import { NextResponse } from "next/server";
import { analyzeLvText, DbTrigger } from "../../../lib/analyzeLvText";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const lvText = String((body as any)?.lvText ?? "");
  const trigger = (body as any)?.trigger as DbTrigger | undefined;

  if (!trigger) {
    return NextResponse.json({ ok: false, error: "No trigger provided" }, { status: 400 });
  }

  // nur diesen einen Trigger testen (keine System-Checks)
  const findings = analyzeLvText(lvText, [trigger]).filter((f) => String(f.id).startsWith("DB_"));

  return NextResponse.json({
    ok: true,
    hit: findings.length > 0,
    count: findings.length,
    findings,
  });
}
