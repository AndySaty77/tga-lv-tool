// app/admin/score/page.tsx
"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";

type CategoryKey =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

const CATEGORY_ORDER: CategoryKey[] = [
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
];

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  vertrags_lv_risiken: "Vertrags-/LV-Risiken",
  mengen_massenermittlung: "Mengen & Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen & Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
};

function catLabel(k: string) {
  return (CATEGORY_LABEL as any)[k] ?? k;
}

function clamp0_100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function traffic(score: number) {
  if (score >= 70) return { dot: "🔴", text: "Rot", tone: "#b00020" };
  if (score >= 40) return { dot: "🟡", text: "Gelb", tone: "#a36b00" };
  return { dot: "🟢", text: "Grün", tone: "#0a7a2f" };
}

function ScoreBarRow(props: { k: CategoryKey; value: number }) {
  const v = clamp0_100(props.value);
  const amp = traffic(v);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr 60px 80px",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ fontWeight: 900, color: "#111" }}>{CATEGORY_LABEL[props.k]}</div>

      <div
        style={{
          height: 14,
          borderRadius: 999,
          background: "#f0f0f0",
          border: "1px solid #e5e5e5",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${v}%`,
            height: "100%",
            background: amp.tone,
            borderRadius: 999,
            transition: "width 200ms",
          }}
        />
      </div>

      <div style={{ textAlign: "right", fontWeight: 900 }}>{v}</div>

      <div style={{ textAlign: "right", fontWeight: 900, color: amp.tone }}>
        {amp.dot} {amp.text}
      </div>
    </div>
  );
}

function ScoreBarsCard(props: { perCategory: Record<string, number>; total: number }) {
  const total = clamp0_100(props.total);
  const totalAmp = traffic(total);

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>Risiko-Ampel je Kategorie</div>
        <div style={{ fontWeight: 900, color: totalAmp.tone }}>
          Gesamt: {total} {totalAmp.dot} {totalAmp.text}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {CATEGORY_ORDER.map((k) => (
          <ScoreBarRow key={k} k={k} value={props.perCategory?.[k] ?? 0} />
        ))}
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12, fontWeight: 700 }}>
        Ampel: 0–39 Grün • 40–69 Gelb • 70–100 Rot
      </div>
    </div>
  );
}

type Finding = {
  id: string;
  category: string; // Key
  title: string;
  detail?: string;
  severity: "low" | "medium" | "high" | string;
  penalty: number;
};

type DebugBlock = {
  detectedDisciplines?: string[];
  triggersUsed?: number;
  perCategorySum?: Record<string, number>;
  sizeF?: number;
  scoringConfigVersion?: number | string;
  easing?: string;
};

type ScoreResult = {
  total: number;
  level: "hochriskant" | "mittel" | "solide" | "sauber" | string;
  perCategory: Record<string, number>; // Keys
  findingsSorted: Finding[];
  debug?: DebugBlock;
};

function levelMeta(level?: string) {
  switch (level) {
    case "hochriskant":
      return { label: "HOCHRISIKO", dot: "🔴" };
    case "mittel":
      return { label: "MITTEL", dot: "🟠" };
    case "solide":
      return { label: "SOLIDE", dot: "🟢" };
    case "sauber":
      return { label: "SAUBER", dot: "🔵" };
    default:
      return { label: level ?? "-", dot: "⚪️" };
  }
}

function severityDot(sev: string) {
  if (sev === "high") return "🔴";
  if (sev === "medium") return "🟠";
  return "🟡";
}

function isDbFinding(f: Finding) {
  return (f.id ?? "").startsWith("DB_");
}
function isSysFinding(f: Finding) {
  return (f.id ?? "").startsWith("SYS_");
}
function stripPrefix(id: string) {
  return id.replace(/^DB_/, "").replace(/^SYS_/, "");
}

function fmtKB(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const MAX_FILE_BYTES = 10_000_000; // 10 MB MVP-Limit

type SourceFilter = "both" | "db" | "sys";
type SeverityFilter = "all" | "high" | "medium" | "low";
type SortMode = "penalty_desc" | "severity_desc" | "category_az";

const severityRank = (sev: string) => {
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  if (sev === "low") return 1;
  return 0;
};

// ===== VORTEXT (LLM) TYPES =====
type RiskClause = {
  type: string;
  riskLevel: "low" | "medium" | "high";
  text: string;
  interpretation: string;
};

function riskIcon(level: "low" | "medium" | "high") {
  if (level === "high") return "🔴";
  if (level === "medium") return "🟡";
  return "🟢";
}

function riskTone(level: "low" | "medium" | "high") {
  if (level === "high") return "#b00020";
  if (level === "medium") return "#a36b00";
  return "#0a7a2f";
}

/**
 * UI-seitig: Vortext grob aus Anfang extrahieren (Fallback).
 */
function extractVortextUI(full: string) {
  const t = (full ?? "").toString();
  if (!t.trim()) return "";

  const HARD_MAX_CHARS = 12000;
  const hardCut = (s: string) => (s.length > HARD_MAX_CHARS ? s.slice(0, HARD_MAX_CHARS) : s);

  const markers = [
    "\ntitel ",
    "\nlos ",
    "\nabschnitt ",
    "\nposition",
    "\npos.",
    "\npos ",
    "\nleistungsverzeichnis",
    "\nkurztext",
    "\nlangtext",
    "\nmenge",
    "\neinheit",
    "\n ep",
    "\ngp",
    "\n€",
    "<position",
    "<pos",
    "<lvpos",
  ];

  const lower = t.toLowerCase();
  let cutIdx = -1;

  for (const m of markers) {
    const i = lower.indexOf(m);
    if (i !== -1) cutIdx = cutIdx === -1 ? i : Math.min(cutIdx, i);
  }

  const candidate = cutIdx > 300 ? t.slice(0, cutIdx) : t;
  return hardCut(candidate.trim());
}

// ===== KEY FACT LABELS (optional nice names) =====
const KEYFACT_LABELS: Record<string, string> = {
  // Termine/Fristen
  baubeginn: "Baubeginn",
  bauzeit: "Bauzeit / Dauer",
  fertigstellung: "Fertigstellung / Abnahme",
  ausfuehrungsfrist: "Ausführungsfrist / Terminplan",
  fristAngebot: "Angebotsfrist",
  bindefrist: "Bindefrist",

  // Vertrag
  vertragsstrafe: "Vertragsstrafe / Pönale",
  gewaerhleistung: "Gewährleistung / Mängelhaftung",
  vob_bgb: "VOB/B / BGB",
  rangfolge: "Rangfolge Vertragsunterlagen",

  // Zahlung/Preis
  zahlungsbedingungen: "Zahlungsbedingungen",
  abschlagszahlung: "Abschlagszahlung",
  schlussrechnung: "Schlussrechnung / Zahlungsziel",
  preisgleitung: "Preisgleitklausel / Rohstoffpreise",
};

function prettyKey(k: string) {
  return (k ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// ===== UI KeyFacts Cleaning (Fix) =====
const KEYFACT_HARD_MAX_VALUE = 260;

function normKeyFactValue(v: any) {
  let s = (v ?? "").toString();
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length > KEYFACT_HARD_MAX_VALUE) s = s.slice(0, KEYFACT_HARD_MAX_VALUE) + "…";
  return s;
}

function isGarbageKeyFactValue(v: string) {
  const s = (v ?? "").trim();
  if (!s) return true;
  if (s.length < 5) return true;

  // reine Satzzeichen / Tokens
  if (/^[\W_]+$/.test(s)) return true;

  // nur Zahl / Mini-Fragmente (führt bei dir zu ":11", ":30", ", d" etc.)
  if (/^[:;,\.\-–—\s]*\d{1,3}\s*$/.test(s)) return true;
  if (/^,\s*[a-z]$/i.test(s)) return true;
  if (/^en:$/i.test(s)) return true;
  if (/^sfrist$/i.test(s)) return true;

  // Kein echtes Wort drin (mind. 3 Buchstaben)
  if (!/[a-zA-ZÄÖÜäöüß]{3,}/.test(s)) return true;

  return false;
}

// ===== SPLIT RESULT =====
type SplitResult = {
  vortext: string;
  positions: string;
  meta?: any;
};

export default function ScorePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [lvText, setLvText] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // ===== GAEB PREVIEW STATE =====
  const [gaebPreviewLoading, setGaebPreviewLoading] = useState(false);
  const [gaebPreviewError, setGaebPreviewError] = useState<string | null>(null);
  const [gaebPreview, setGaebPreview] = useState<any>(null);
  const [gaebTab, setGaebTab] = useState<
    "vortext" | "positions" | "raw" | "clean" | "llm_vortext" | "llm_positions"
  >("vortext");

  // ===== SPLIT (LLM) STATE =====
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitResult | null>(null);

  // ===== VORTEXT (LLM) STATE =====
  const [vortextLoading, setVortextLoading] = useState(false);
  const [vortextError, setVortextError] = useState<string | null>(null);
  const [riskClauses, setRiskClauses] = useState<RiskClause[]>([]);
  const [keyFacts, setKeyFacts] = useState<Record<string, string>>({});
  // optional: falls Route später confidence liefert
  const [keyFactConfidence, setKeyFactConfidence] = useState<Record<string, number>>({});

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("both");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("penalty_desc");
  const [top10, setTop10] = useState(false);

  const meta = levelMeta(result?.level);
  const totalAmp = traffic(clamp0_100(result?.total ?? 0));

  const resetVortext = () => {
    setVortextError(null);
    setRiskClauses([]);
    setKeyFacts({});
    setKeyFactConfidence({});
    setVortextLoading(false);
  };

  const resetGaebPreview = () => {
    setGaebPreview(null);
    setGaebPreviewError(null);
    setGaebPreviewLoading(false);
    setGaebTab("vortext");
  };

  const resetSplit = () => {
    setSplit(null);
    setSplitError(null);
    setSplitLoading(false);
  };

  const runGaebPreview = async (file: File) => {
    resetGaebPreview();
    setGaebPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/gaeb-preview", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || j?.error || "gaeb-preview failed");
      setGaebPreview(j);
    } catch (e: any) {
      setGaebPreviewError(e?.message || "gaeb-preview failed");
      setGaebPreview(null);
    } finally {
      setGaebPreviewLoading(false);
    }
  };

  const runGaebSplitLLM = async (file: File) => {
    resetSplit();
    setSplitLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/gaeb-split-llm", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || j?.error || "gaeb-split-llm failed");
      const s: SplitResult = {
        vortext: String(j?.vortext ?? ""),
        positions: String(j?.positions ?? ""),
        meta: j?.meta ?? j?.debug ?? null,
      };
      setSplit(s);
    } catch (e: any) {
      setSplitError(e?.message || "gaeb-split-llm failed");
      setSplit(null);
    } finally {
      setSplitLoading(false);
    }
  };

  const analyzeVortextLLM = async (vortext: string) => {
    setVortextLoading(true);
    setVortextError(null);
    setRiskClauses([]);
    setKeyFacts({});
    setKeyFactConfidence({});

    try {
      const vRes = await fetch("/api/analyze-vortext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: vortext }),
      });

      const vData = await vRes.json();

      if (!vRes.ok) {
        setVortextError(vData?.message || vData?.error || "Vortext Analyse fehlgeschlagen");
        setRiskClauses([]);
        setKeyFacts({});
        setKeyFactConfidence({});
      } else {
        const clauses = Array.isArray(vData?.riskClauses) ? vData.riskClauses : [];
        setRiskClauses(clauses);

        const facts = vData?.keyFacts && typeof vData.keyFacts === "object" ? vData.keyFacts : {};
        setKeyFacts(facts);

        const conf =
          vData?.keyFactConfidence && typeof vData.keyFactConfidence === "object" ? vData.keyFactConfidence : {};
        setKeyFactConfidence(conf);
      }
    } catch (e: any) {
      setVortextError(e?.message || "Vortext Analyse fehlgeschlagen");
      setRiskClauses([]);
      setKeyFacts({});
      setKeyFactConfidence({});
    } finally {
      setVortextLoading(false);
    }
  };

  const analyze = async (textOverride?: string) => {
    const textToUse = (textOverride ?? lvText).trim();
    if (!textToUse) return;

    setError(null);
    setLoading(true);
    setResult(null);
    resetVortext();

    try {
      const debug =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
      const apiUrl = debug ? "/api/score?debug=1" : "/api/score";

      // Wenn wir einen Split haben: score sauber getrennt schicken
      const payload: any = { lvText: textToUse };
      if (split?.vortext || split?.positions) {
        payload.vortext = split?.vortext ?? "";
        payload.positions = split?.positions ?? "";
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API ${res.status}: ${t}`);
      }

      const data = (await res.json()) as ScoreResult;
      setResult(data);

      const cats = new Set((data.findingsSorted ?? []).map((f) => f.category));
      if (categoryFilter !== "all" && !cats.has(categoryFilter)) setCategoryFilter("all");

      // ===== VORTEXT ANALYSE =====
      // Priorität: Split-LLM Vortext -> sonst UI-Fallback
      const vortextForRisk = (split?.vortext ?? "").trim() || extractVortextUI(textToUse);
      if (vortextForRisk.trim().length > 0) {
        await analyzeVortextLLM(vortextForRisk);
      } else {
        setVortextError("Vortext ist leer (Split/Extraktion hat nichts geliefert).");
      }
    } catch (e: any) {
      setError(e?.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (file: File) => {
    setError(null);
    setResult(null);
    resetVortext();
    resetGaebPreview();
    resetSplit();

    setLastFile(file);

    if (file.size > MAX_FILE_BYTES) {
      setFileMeta({ name: file.name, size: file.size });
      setLvText("");
      setError(`Datei zu groß (${fmtKB(file.size)}). Limit aktuell: ${fmtKB(MAX_FILE_BYTES)}.`);
      return;
    }

    // 1) Preview (Debug)
    await runGaebPreview(file);

    // 2) LLM Split (Echte Trennung, stabiler als Guess)
    await runGaebSplitLLM(file);

    // 3) Originaltext in Textarea (Debug/Transparenz)
    const text = await file.text();
    setFileMeta({ name: file.name, size: file.size });
    setLvText(text);

    if (autoAnalyze) await analyze(text);
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    await loadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await loadFile(file);
  };

  const availableFindingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const f of result?.findingsSorted ?? []) set.add(f.category);
    const arr = Array.from(set);

    arr.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a as any);
      const ib = CATEGORY_ORDER.indexOf(b as any);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });

    return arr;
  }, [result]);

  const filteredFindings = useMemo(() => {
    const all = result?.findingsSorted ?? [];
    const q = search.trim().toLowerCase();

    let list = all.filter((f) => {
      if (sourceFilter === "db" && !isDbFinding(f)) return false;
      if (sourceFilter === "sys" && !isSysFinding(f)) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;

      if (q) {
        const hay = `${f.title ?? ""} ${f.detail ?? ""} ${f.id ?? ""} ${f.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortMode === "penalty_desc") return (b.penalty ?? 0) - (a.penalty ?? 0);
      if (sortMode === "severity_desc") return severityRank(b.severity) - severityRank(a.severity);
      if (sortMode === "category_az") return (a.category ?? "").localeCompare(b.category ?? "");
      return 0;
    });

    if (top10) list = list.slice(0, 10);
    return list;
  }, [result, sourceFilter, severityFilter, categoryFilter, search, sortMode, top10]);

  const dbFindings = useMemo(() => filteredFindings.filter(isDbFinding), [filteredFindings]);
  const sysFindings = useMemo(() => filteredFindings.filter(isSysFinding), [filteredFindings]);
  const otherFindings = useMemo(
    () => filteredFindings.filter((f) => !isDbFinding(f) && !isSysFinding(f)),
    [filteredFindings]
  );

  const resetFilters = () => {
    setSourceFilter("both");
    setSeverityFilter("all");
    setCategoryFilter("all");
    setSearch("");
    setSortMode("penalty_desc");
    setTop10(false);
  };

  // ✅ Fix: KeyFacts filtern/normalisieren, damit kein Müll mehr angezeigt wird
  const keyFactsEntries = useMemo(() => {
    const conf = keyFactConfidence ?? {};
    const entries = Object.entries(keyFacts ?? {})
      .map(([k, v]) => [k, normKeyFactValue(v)] as const)
      .filter(([k, v]) => {
        if (!v) return false;
        if (isGarbageKeyFactValue(v)) return false;

        // optional confidence filter (falls vorhanden)
        const c = Number(conf[k]);
        if (Number.isFinite(c) && c > 0 && c < 0.55) return false;

        return true;
      });

    entries.sort(([a], [b]) => {
      const la = KEYFACT_LABELS[a] ? 0 : 1;
      const lb = KEYFACT_LABELS[b] ? 0 : 1;
      if (la !== lb) return la - lb;
      return a.localeCompare(b);
    });

    return entries;
  }, [keyFacts, keyFactConfidence]);

  const gaebTextForTab = useMemo(() => {
    if (gaebTab === "llm_vortext") return (split?.vortext ?? "").toString();
    if (gaebTab === "llm_positions") return (split?.positions ?? "").toString();

    if (!gaebPreview) return "";
    if (gaebTab === "vortext") return gaebPreview.vortextGuessClean ?? "";
    if (gaebTab === "positions") return gaebPreview.positionsGuessClean ?? "";
    if (gaebTab === "raw") return gaebPreview.rawPreview ?? "";
    return gaebPreview.cleanPreview ?? "";
  }, [gaebPreview, gaebTab, split]);

  const effectiveVortextLen = (split?.vortext ?? "").trim().length;
  const effectivePositionsLen = (split?.positions ?? "").trim().length;

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>TGA LV Score</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Upload oder Text rein, Score raus. Jetzt mit LLM-Split (Vortext/Positionen) statt Guess-Heuristik.
          </div>
        </div>
        <a href="/admin/triggers" style={{ color: "#111", textDecoration: "underline" }}>
          Trigger-Admin
        </a>
      </div>

      {/* Upload + Input Card */}
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          background: "#fafafa",
        }}
      >
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? "#111" : "#ddd"}`,
            borderRadius: 14,
            padding: 14,
            background: dragOver ? "#f1f1f1" : "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 900 }}>Drag & Drop Datei hier rein</div>
            <div style={{ color: "#666", marginTop: 4 }}>
              GAEB-Preview (Debug) + LLM-Split (Produktiv): trennt Vortext/Positionen robust.
            </div>
            {fileMeta && (
              <div style={{ marginTop: 8, color: "#111", fontWeight: 700 }}>
                Geladen: {fileMeta.name}{" "}
                <span style={{ color: "#666", fontWeight: 600 }}>({fmtKB(fileMeta.size)})</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.xml,.gaeb,.x83,.x84,.x86,.json"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Datei wählen
            </button>

            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
              <span style={{ fontWeight: 700, color: "#111" }}>Auto-Analyse</span>
            </label>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          rows={10}
          style={{
            width: "100%",
            marginTop: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            padding: 12,
            resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
          placeholder="LV Text hier einfügen..."
          value={lvText}
          onChange={(e) => setLvText(e.target.value)}
        />

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => analyze()}
            disabled={loading || lvText.trim().length === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: loading ? "#eee" : "#111",
              color: loading ? "#111" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 800,
            }}
          >
            {loading ? "Analysiere..." : "Analysieren"}
          </button>

          <button
            onClick={async () => {
              if (!lastFile) {
                setSplitError("Kein File vorhanden (nur Text im Feld). Re-Split geht nur mit Datei.");
                return;
              }
              await runGaebSplitLLM(lastFile);
            }}
            disabled={splitLoading || !lastFile}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: splitLoading || !lastFile ? "default" : "pointer",
              fontWeight: 800,
            }}
            title={!lastFile ? "Nur möglich, wenn eine Datei geladen wurde." : ""}
          >
            {splitLoading ? "Splitte..." : "LLM-Split neu ausführen"}
          </button>

          <button
            onClick={() => {
              setLvText("");
              setResult(null);
              setError(null);
              setFileMeta(null);
              setLastFile(null);
              resetVortext();
              resetGaebPreview();
              resetSplit();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Reset
          </button>

          <div style={{ color: "#666", display: "flex", alignItems: "center" }}>Limit: {fmtKB(MAX_FILE_BYTES)}</div>
        </div>

        {error && <div style={{ marginTop: 12, color: "#b00020", fontWeight: 800 }}>{error}</div>}
      </div>

      {/* GAEB Preview Card */}
      <div style={{ marginTop: 14, border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>GAEB PREVIEW + SPLIT</div>
          <div style={{ color: "#666", fontWeight: 700 }}>
            {gaebPreviewLoading ? "Lade…" : gaebPreview ? `${gaebPreview.filename} (${fmtKB(gaebPreview.size)})` : "—"}
          </div>
        </div>

        {(gaebPreviewError || splitError) && (
          <div style={{ marginTop: 10, color: "#b00020", fontWeight: 800 }}>
            {gaebPreviewError ? `Preview: ${gaebPreviewError}` : ""}
            {gaebPreviewError && splitError ? " • " : ""}
            {splitError ? `Split: ${splitError}` : ""}
          </div>
        )}

        {!gaebPreviewLoading && (gaebPreview || split) && (
          <>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["llm_vortext", "llm_positions", "vortext", "positions", "raw", "clean"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setGaebTab(t)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: gaebTab === t ? "#111" : "#fff",
                    color: gaebTab === t ? "#fff" : "#111",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  {t === "llm_vortext"
                    ? "LLM Vortext"
                    : t === "llm_positions"
                      ? "LLM Positionen"
                      : t === "vortext"
                        ? "Vortext (guess)"
                        : t === "positions"
                          ? "Positionen (guess)"
                          : t === "raw"
                            ? "Raw"
                            : "Clean"}
                </button>
              ))}

              <button
                onClick={() => setLvText(gaebTextForTab || "")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                In Textfeld übernehmen
              </button>
            </div>

            <pre
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #eee",
                background: "#fafafa",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                maxHeight: 260,
                overflow: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {gaebTextForTab}
            </pre>

            <div style={{ marginTop: 8, color: "#666", fontSize: 12, fontWeight: 700 }}>
              {split ? (
                <>
                  Split(LLM): vortext {effectiveVortextLen} chars • positions {effectivePositionsLen} chars
                </>
              ) : (
                <>
                  Debug: raw {gaebPreview?.debug?.rawChars} chars • preview {gaebPreview?.debug?.previewChars} • vortext{" "}
                  {gaebPreview?.debug?.vortextChars}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {/* Top Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
            {/* Score Card */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 800 }}>GESAMT</div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>
                  {meta.dot} {meta.label}
                </div>
              </div>

              <div style={{ fontSize: 44, fontWeight: 900, marginTop: 10, color: totalAmp.tone }}>
                {clamp0_100(result.total)}
                <span style={{ fontSize: 16, color: "#666", marginLeft: 8 }}>/ 100</span>
              </div>

              <div style={{ marginTop: 10, height: 12, background: "#eee", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${clamp0_100(result.total)}%`,
                    height: 12,
                    background: totalAmp.tone,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ marginTop: 10, color: "#666", fontWeight: 700, fontSize: 12 }}>
                Ampel: 0–39 Grün • 40–69 Gelb • 70–100 Rot
              </div>
            </div>

            {/* Category Bars */}
            <ScoreBarsCard perCategory={result.perCategory ?? {}} total={result.total} />
          </div>

          {/* ===== KEY FACTS CARD (DYNAMIC) ===== */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>KEY FACTS (VORTEXT)</div>
              <div style={{ color: "#666", fontWeight: 700 }}>
                {vortextLoading ? "Extrahiere…" : `${keyFactsEntries.length} Felder`}
              </div>
            </div>

            {vortextError && (
              <div style={{ marginTop: 10, color: "#666", fontWeight: 700 }}>
                (Key Facts nicht verfügbar, weil Vortext-Analyse fehlgeschlagen ist.)
              </div>
            )}

            {!vortextLoading && !vortextError && keyFactsEntries.length === 0 && (
              <div style={{ marginTop: 10, color: "#666", fontWeight: 700 }}>Keine Key Facts gefunden.</div>
            )}

            {!vortextError && keyFactsEntries.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {keyFactsEntries.map(([k, v]) => {
                  const c = Number(keyFactConfidence?.[k]);
                  const hasC = Number.isFinite(c) && c > 0;
                  return (
                    <div key={k} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ fontSize: 12, color: "#666", fontWeight: 900 }}>
                        {KEYFACT_LABELS[k] ?? prettyKey(k)}
                      </div>

                      {hasC && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "#999", fontWeight: 800 }}>
                          Confidence: {Math.round(c * 100)}%
                        </div>
                      )}

                      <div style={{ marginTop: 6, fontWeight: 800, color: "#111", whiteSpace: "pre-wrap" }}>{v}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 10, color: "#666", fontSize: 12, fontWeight: 700 }}>
              Hinweis: Vortext kommt jetzt aus LLM-Split. Wenn der leer ist, stimmt der GAEB-Import oder die Datei nicht.
            </div>
          </div>

          {/* ===== VORTEXT RISIKO CARD ===== */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>VORTEXT RISIKEN (LLM)</div>
              <div style={{ color: "#666", fontWeight: 700 }}>
                {vortextLoading ? "Analysiere…" : `${riskClauses.length} Treffer`}
              </div>
            </div>

            {vortextError && (
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid #f2c2c7",
                  background: "#fdecef",
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <div style={{ fontWeight: 900, color: "#b00020" }}>Fehler</div>
                <div style={{ marginTop: 6, color: "#8a0010", fontWeight: 700 }}>{vortextError}</div>
              </div>
            )}

            {!vortextLoading && !vortextError && riskClauses.length === 0 && (
              <div style={{ marginTop: 10, color: "#666", fontWeight: 700 }}>Keine auffälligen Risikoformulierungen erkannt.</div>
            )}

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {riskClauses.map((r, idx) => (
                <div key={idx} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 900, color: "#111" }}>
                      {riskIcon(r.riskLevel)} {r.type || "Risiko"}
                    </div>
                    <div style={{ fontWeight: 900, color: riskTone(r.riskLevel) }}>{String(r.riskLevel).toUpperCase()}</div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #eee",
                      background: "#fafafa",
                      whiteSpace: "pre-wrap",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                    }}
                  >
                    {r.text}
                  </div>

                  {r.interpretation && (
                    <div style={{ marginTop: 8, color: "#333" }}>
                      <span style={{ fontWeight: 900 }}>Interpretation:</span> {r.interpretation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, color: "#666", fontSize: 12, fontWeight: 700 }}>
              Hinweis: Das ist jetzt wirklich Vortext (LLM-Split) – nicht mehr “guess bis 6.4”.
            </div>
          </div>

          {/* ✅ Debug Card */}
          {result.debug && (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>DEBUG</div>
                <div style={{ color: "#666", fontWeight: 700 }}>
                  Config: {String(result.debug.scoringConfigVersion ?? "-")} • Easing: {String(result.debug.easing ?? "-")}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>
                  detectedDisciplines:{" "}
                  <span style={{ fontWeight: 700, color: "#111" }}>
                    {(result.debug.detectedDisciplines ?? []).join(", ") || "(leer)"}
                  </span>
                </div>
                <div style={{ fontWeight: 800 }}>
                  triggersUsed: <span style={{ fontWeight: 700, color: "#111" }}>{result.debug.triggersUsed ?? "-"}</span>
                </div>
                <div style={{ fontWeight: 800 }}>
                  sizeF: <span style={{ fontWeight: 700, color: "#111" }}>{result.debug.sizeF ?? "-"}</span>
                </div>

                <div style={{ fontWeight: 900, marginTop: 6 }}>perCategorySum (roh)</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: "#fafafa",
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {JSON.stringify(result.debug.perCategorySum ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>FILTER</div>
              <div style={{ color: "#666", fontWeight: 700 }}>Treffer nach Filter: {filteredFindings.length}</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto", gap: 10 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche (Titel, Detail, ID, Kategorie)..."
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              />

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="both">Quelle: DB + SYS</option>
                <option value="db">Quelle: nur DB</option>
                <option value="sys">Quelle: nur SYS</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="all">Severity: alle</option>
                <option value="high">Severity: high</option>
                <option value="medium">Severity: medium</option>
                <option value="low">Severity: low</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="all">Kategorie: alle</option>
                {availableFindingCategories.map((c) => (
                  <option key={c} value={c}>
                    {catLabel(c)}
                  </option>
                ))}
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="penalty_desc">Sort: Penalty ↓</option>
                <option value="severity_desc">Sort: Severity ↓</option>
                <option value="category_az">Sort: Kategorie A–Z</option>
              </select>

              <button
                onClick={resetFilters}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Reset
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={top10} onChange={(e) => setTop10(e.target.checked)} />
                <span style={{ fontWeight: 800 }}>Nur Top 10</span>
              </label>

              <div style={{ color: "#666", fontWeight: 700 }}>
                DB: {dbFindings.length} | SYS: {sysFindings.length}
                {otherFindings.length > 0 ? ` | Other: ${otherFindings.length}` : ""}
              </div>
            </div>
          </div>

          {/* Findings Blocks */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* DB */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>SUPABASE TRIGGER</div>
                <div style={{ color: "#666" }}>{dbFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {dbFindings.length === 0 ? (
                  <div style={{ color: "#666" }}>Keine DB-Trigger nach Filter.</div>
                ) : (
                  dbFindings.map((f) => (
                    <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {severityDot(f.severity)} {f.title}
                        </div>
                        <div style={{ color: "#666", fontWeight: 900 }}>
                          -{f.penalty} ({catLabel(f.category)})
                        </div>
                      </div>
                      {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>id: {stripPrefix(f.id)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SYS */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>SYSTEM CHECKS</div>
                <div style={{ color: "#666" }}>{sysFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sysFindings.length === 0 ? (
                  <div style={{ color: "#666" }}>Keine System-Checks nach Filter.</div>
                ) : (
                  sysFindings.map((f) => (
                    <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {severityDot(f.severity)} {f.title}
                        </div>
                        <div style={{ color: "#666", fontWeight: 900 }}>
                          -{f.penalty} ({catLabel(f.category)})
                        </div>
                      </div>
                      {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>id: {stripPrefix(f.id)}</div>
                    </div>
                  ))
                )}
              </div>

              {otherFindings.length > 0 && (
                <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  Hinweis: {otherFindings.length} Findings ohne Prefix (DB_/SYS_) im Ergebnis.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
