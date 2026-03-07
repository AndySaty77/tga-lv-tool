import { NextResponse } from "next/server";

/**
 * Interner Status: Ist OpenAI für KI-Funktionen konfiguriert?
 * Keine sensiblen Daten, nur Boolean für Admin-UI.
 */
export async function GET() {
  const configured = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
  return NextResponse.json({ openaiConfigured: configured });
}
