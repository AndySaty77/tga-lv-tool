// app/api/gaeb-split-llm/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { stripEmbeddedBinaryAndBase64Artifacts } from "@/lib/sanitizeAnalysisText";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/auth/is-admin";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const HARD_MAX_CHARS = 200_000; // Schutz vor riesigen Uploads
const MAX_UPLOAD_BYTES = 10_000_000;
const GAEB_SPLIT_RATE_LIMIT_PER_10_MIN = 10;
const GAEB_SPLIT_RATE_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_EXTENSIONS = new Set([".x83", ".x84", ".x86", ".xml", ".gaeb", ".txt"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "text/xml",
  "application/xml",
  "application/octet-stream",
]);

function getLowercaseExtension(filename: string): string {
  const clean = (filename ?? "").trim().toLowerCase();
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === clean.length - 1) return "";
  return clean.slice(dotIdx);
}

function isAllowedUploadFile(file: File): boolean {
  const ext = getLowercaseExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const mime = (file.type ?? "").trim().toLowerCase();
  // Einige Browser liefern für diese Dateien keinen verlässlichen MIME-Type.
  return mime.length === 0 || ALLOWED_MIME_TYPES.has(mime);
}

function normalizeNewlines(s: string) {
  return (s ?? "").toString().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function hardCut(s: string, max: number) {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
}

function stripHtml(input: string) {
  let s = (input ?? "").toString();
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<\/?[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s*\n\s*/g, "\n");
  return s.trim();
}

function findCutByMarker(text: string, marker: string) {
  const t = normalizeNewlines(text);
  const m = normalizeNewlines(marker);

  let idx = t.indexOf(m);
  if (idx !== -1) return { idx, used: "exact" as const };

  // Fallback: nur erste Zeile des Markers
  const firstLine = m.split("\n").map((x) => x.trim()).filter(Boolean)[0] ?? "";
  if (firstLine.length >= 6) {
    idx = t.indexOf(firstLine);
    if (idx !== -1) return { idx, used: "firstLine" as const };
  }

  // Fallback: case-insensitive Suche (Marker klein)
  const tl = t.toLowerCase();
  const ml = m.toLowerCase();
  idx = tl.indexOf(ml);
  if (idx !== -1) return { idx, used: "ci-exact" as const };

  if (firstLine.length >= 6) {
    idx = tl.indexOf(firstLine.toLowerCase());
    if (idx !== -1) return { idx, used: "ci-firstLine" as const };
  }

  return { idx: -1, used: "notFound" as const };
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `gaeb-split-llm:${ip}`,
      GAEB_SPLIT_RATE_LIMIT_PER_10_MIN,
      GAEB_SPLIT_RATE_WINDOW_MS
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const reqUrl = new URL(req.url);
    const user = await getUser().catch(() => null);
    const includeDebugPayload = reqUrl.searchParams.get("debug") === "1" && !!user && isAdmin(user);

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided (field name: file)" }, { status: 400 });
    }

    const f = file as File;
    if (!isAllowedUploadFile(f)) {
      return NextResponse.json(
        {
          error: "Ungültiger Dateityp. Erlaubt: .x83, .x84, .x86, .xml, .gaeb, .txt",
        },
        { status: 400 }
      );
    }
    if (!Number.isFinite(f.size) || f.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Datei zu groß. Maximal erlaubt: ${MAX_UPLOAD_BYTES} Bytes`,
        },
        { status: 413 }
      );
    }
    const raw = normalizeNewlines(await f.text());
    const rawPreview = hardCut(raw, HARD_MAX_CHARS);

    // Cleaned Text ans LLM (weil viele Exporte HTML/komische Breaks haben)
    const clean = stripEmbeddedBinaryAndBase64Artifacts(stripHtml(rawPreview));

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const schema = {
      name: "GaebSplit",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          marker: { type: "string", description: "Exakter Marker (1-3 Zeilen) der den BEGINN des Positions-/LV-Teils markiert. Muss im Text exakt vorkommen." },
          marker_line_count: { type: "integer", minimum: 1, maximum: 3 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
        required: ["marker", "marker_line_count", "confidence", "reason"],
      },
    } as const;

    const prompt = `
Du bekommst einen GAEB/LV-Text-Export (bereinigt). Aufgabe: Finde den Übergang von VORTEXT (allgemeine Angaben, Vertragsbedingungen, Vorbemerkungen, Zertifizierungsanforderungen, etc.)
zu POSITIONS-/LV-TEIL (Titel/Abschnitte/Positionen mit Mengen/Einheiten, Kurztext/Langtext, Artikel, Fabrikat, etc.).

Wichtig:
- Antworte NUR als JSON nach Schema.
- Gib "marker" als exakt im Text vorkommende Zeichenfolge aus.
- marker muss 1 bis 3 ZEILEN enthalten und den BEGINN des Positions-/LV-Teils markieren (also ab da beginnt "TITEL ...", "Einrichtungsgegenstände", oder der erste Block mit Menge/Einheit/Positionsbezeichnung).
- Wähle einen Marker, der eindeutig ist und sehr wahrscheinlich exakt im Text vorkommt.
- Wenn mehrere möglich sind: nimm den frühesten Beginn des Positions-/LV-Teils.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_schema", json_schema: schema as any },
      messages: [
        { role: "system", content: "Du bist ein präziser Parser für deutsche GAEB/LV-Text-Exporte." },
        { role: "user", content: prompt + "\n\nTEXT:\n" + clean },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      if (process.env.NODE_ENV !== "test") {
        console.error("[gaeb-split-llm] non_json_response");
      }
      return NextResponse.json({ error: "gaeb-split-llm failed" }, { status: 500 });
    }

    const marker: string = (parsed.marker ?? "").toString();
    const found = findCutByMarker(clean, marker);

    if (found.idx === -1) {
      const markerNotFoundResponse: Record<string, unknown> = {
        filename: f.name,
        size: f.size,
        error: "marker-not-found-in-text",
      };
      if (includeDebugPayload) {
        markerNotFoundResponse.llm = parsed;
        markerNotFoundResponse.debug = {
          previewChars: rawPreview.length,
          cleanChars: clean.length,
          markerPreview: marker.slice(0, 400),
        };
      }
      return NextResponse.json(markerNotFoundResponse, { status: 422 });
    }

    const cutIdx = found.idx;
    const vortext = clean.slice(0, cutIdx).trim();
    const positions = clean.slice(cutIdx).trim();

    const responsePayload: Record<string, unknown> = {
      filename: f.name,
      size: f.size,
      vortext,
      positions,
      meta: {
        cutFoundBy: found.used,
        vortextChars: vortext.length,
        positionsChars: positions.length,
      },
    };

    if (includeDebugPayload) {
      responsePayload.llm = {
        marker,
        marker_line_count: parsed.marker_line_count,
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
      responsePayload.debug = {
        cutIdx,
        cutFoundBy: found.used,
        vortextChars: vortext.length,
        positionsChars: positions.length,
        positionsStartsWith: positions.slice(0, 300),
      };
    }

    return NextResponse.json(responsePayload);
  } catch (e: unknown) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[gaeb-split-llm] failed", e instanceof Error ? e.message : String(e));
    }
    return NextResponse.json(
      { error: "gaeb-split-llm failed" },
      { status: 500 }
    );
  }
}
