import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

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
- unklaren Verantwortlichkeiten

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
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Du bist Experte für TGA Leistungsverzeichnisse." },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0].message.content ?? "{}";
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Vortext Analyse fehlgeschlagen" },
      { status: 500 }
    );
  }
}
