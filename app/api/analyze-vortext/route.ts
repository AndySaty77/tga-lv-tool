import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return { riskClauses: [], raw: s };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body?.text ?? "").toString().trim();

    if (!text) {
      return NextResponse.json(
        { riskClauses: [], error: "No text provided" },
        { status: 400 }
      );
    }

    const prompt = `
Du bist TGA Sachverständiger.

Analysiere folgenden LV Text auf Risikoformulierungen in Vorbemerkungen (Vortext).
Suche insbesondere nach:
- pauschalen Nebenleistungen
- unklaren Leistungsabgrenzungen
- fehlenden Normbezügen
- unbegrenzten Leistungsumfängen
- Gewerkekoordination
- Funktionsgarantien
- unklare Verantwortlichkeiten

Antworte NUR als JSON im Format:
{
 "riskClauses":[
   {
     "type":"string",
     "riskLevel":"low | medium | high",
     "text":"original text excerpt",
     "interpretation":"technical explanation"
   }
 ]
}

LV TEXT:
${text}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Du bist Experte für TGA Leistungsverzeichnisse." },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const data = safeJsonParse(content);

    if (!data || typeof data !== "object") {
      return NextResponse.json({ riskClauses: [], raw: content });
    }
    if (!("riskClauses" in data)) {
      return NextResponse.json({ riskClauses: [], ...data });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("analyze-vortext error:", err);

    return NextResponse.json(
      {
        error: "Vortext Analyse fehlgeschlagen",
        message: err?.message ?? String(err),
        type: err?.type,
        code: err?.code,
        status: err?.status,
      },
      { status: 500 }
    );
  }
}
