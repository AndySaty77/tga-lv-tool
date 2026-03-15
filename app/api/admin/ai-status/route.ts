import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/auth/is-admin";

/**
 * Interner Status: Ist OpenAI für KI-Funktionen konfiguriert?
 * Keine sensiblen Daten, nur Boolean für Admin-UI.
 */
export async function GET() {
  const user = await getUser().catch(() => null);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const configured = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
  return NextResponse.json({ openaiConfigured: configured });
}
