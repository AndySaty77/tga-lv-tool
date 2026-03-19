/**
 * Family-Mapping für Nachtragspotenzial V2.
 * Nur auf Texte anwenden, die den Claim-/Gap-Filter bestanden haben.
 * Berücksichtigt vorgelagerte Claim-/Gap-Typisierung.
 * schnittstelle nur bei echten Abgrenzungs-/Schnittstellenfällen (passender Typ).
 */

import type { ClaimGapType } from "./claimGapType";

export type TechnicalFamilyId =
  | "heizung"
  | "lueftung"
  | "sanitaer"
  | "elektro"
  | "msr"
  | "bau"
  | "schnittstelle"
  | "schnittstelle_bau"
  | "unknown";

/** Legacy: NachtragFamilyId für Kompatibilität mit Caps/Anchors. */
export type NachtragFamilyId = TechnicalFamilyId;

export type NachtragFamily = {
  id: NachtragFamilyId;
  label: string;
};

/** Gewichtete Keywords: [keyword, weight]. Weight 2 = stark, 1 = normal, 0.5 = schwach. */
type WeightedKeywords = Array<[string, number]>;

const FAMILY_KEYWORDS: Record<Exclude<TechnicalFamilyId, "schnittstelle" | "schnittstelle_bau" | "unknown">, WeightedKeywords> = {
  heizung: [
    ["wärmepumpe", 2],
    ["heizkessel", 2],
    ["heizkörper", 2],
    ["fußbodenheizung", 2],
    ["heizkreis", 1.5],
    ["thermostat", 1],
    ["vorlauf", 0.5],
    ["rücklauf", 0.5],
    ["heizung", 0.5],
    ["heiz", 0.5],
    ["wärme", 0.5],
    ["kessel", 0.5],
    ["speicher", 0.5],
  ],
  lueftung: [
    ["klimaanlage", 2],
    ["rwa", 2],
    ["abluft", 1.5],
    ["zuluft", 1.5],
    ["fortluft", 1.5],
    ["lüftung", 1],
    ["lueftung", 1],
    ["rauch", 1],
    ["klima", 0.5],
    ["lüft", 0.5],
    ["luftung", 0.5],
    ["entlüftung", 0.5],
  ],
  sanitaer: [
    ["trinkwasser", 2],
    ["abwasser", 2],
    ["sanitär", 1.5],
    ["sanitaer", 1.5],
    ["spül", 1.5],
    ["spuel", 1.5],
    ["rohr", 1],
    ["leitung", 1],
    ["wc", 1],
    ["bad", 1],
    ["wasser", 0.5],
    ["entwässerung", 0.5],
    ["abfluss", 0.5],
  ],
  elektro: [
    ["notstrom", 2],
    ["aggregat", 2],
    ["verteiler", 1.5],
    ["elektro", 1],
    ["elektrik", 1],
    ["kabel", 1],
    ["schalt", 1],
    ["beleuchtung", 1],
    ["strom", 0.5],
    ["licht", 0.5],
    ["anschluss", 0.5],
    ["zuleitung", 0.5],
    ["einspeisung", 0.5],
  ],
  msr: [
    ["gebäudeautomation", 2],
    ["sensor", 1.5],
    ["aktor", 1.5],
    ["msr", 1.5],
    ["bus", 1],
    ["regelung", 1],
    ["automation", 0.5],
    ["ga", 0.5],
    ["steuerung", 0.5],
    ["feldbus", 0.5],
  ],
  bau: [
    ["durchbruch", 2],
    ["kernbohrung", 2],
    ["aussparung", 2],
    ["brandschott", 2],
    ["verguss", 2],
    ["mauerwerk", 2],
    ["betonarbeiten", 2],
    ["schacht", 1.5],
    ["öffnung", 1.5],
    ["oeffnung", 1.5],
  ],
};

const FAMILIES: Record<TechnicalFamilyId, NachtragFamily> = {
  heizung: { id: "heizung", label: "Heizung" },
  lueftung: { id: "lueftung", label: "Lüftung" },
  sanitaer: { id: "sanitaer", label: "Sanitär" },
  elektro: { id: "elektro", label: "Elektro" },
  msr: { id: "msr", label: "MSR" },
  bau: { id: "bau", label: "Bau" },
  schnittstelle: { id: "schnittstelle", label: "Schnittstelle (mehrere technische Familien)" },
  schnittstelle_bau: { id: "schnittstelle_bau", label: "Schnittstelle Bau + technisch" },
  unknown: { id: "unknown", label: "Unbekannt" },
};

const TECH_FAMILIES: Exclude<TechnicalFamilyId, "schnittstelle" | "schnittstelle_bau" | "unknown">[] = [
  "heizung",
  "lueftung",
  "sanitaer",
  "elektro",
  "msr",
  "bau",
];

/** Mindest-Score für belastbares Family-Match (gewichtete Summe). */
const MIN_SCORE_THRESHOLD = 1.0;
/** Mindest-Score für Konflikt (schnittstelle/schnittstelle_bau) – verhindert Zufallstreffer. */
const MIN_STRONG_SCORE_FOR_CONFLICT = 2;

function countTechFamiliesWithScore(scores: Record<string, number>, minScore: number): number {
  return (TECH_FAMILIES as readonly string[]).filter((f) => f !== "bau" && scores[f] >= minScore).length;
}

function scoreFamily(text: string, familyId: Exclude<TechnicalFamilyId, "schnittstelle" | "schnittstelle_bau" | "unknown">): number {
  const lower = text.toLowerCase();
  const keywords = FAMILY_KEYWORDS[familyId];
  let score = 0;
  for (const [kw, w] of keywords) {
    if (w > 0 && lower.includes(kw)) score += w;
  }
  return score;
}

/** Typen, die schnittstelle/schnittstelle_bau rechtfertigen (echte Abgrenzung). */
const SCHNITTSTELLE_TYPES: ClaimGapType[] = ["bauseits_other_trade", "coordination_interface"];

function allowsSchnittstelle(claimGapType: ClaimGapType): boolean {
  return SCHNITTSTELLE_TYPES.includes(claimGapType);
}

/**
 * Ermittelt die Family aus Text und Claim-/Gap-Typ.
 * schnittstelle nur bei Mehrfachmatch + passendem Typ (bauseits_other_trade oder coordination_interface).
 * coordination_interface allein ohne belastbare Fachfamilie → unknown.
 * documentation_acceptance erzwingt keine technische Familie.
 */
export function resolveFamilyFromText(text: string, claimGapType?: ClaimGapType): TechnicalFamilyId {
  const t = (text ?? "").trim();
  const type = claimGapType ?? "none";
  if (t.length < 5) return "unknown";

  const scores: Record<Exclude<TechnicalFamilyId, "schnittstelle" | "schnittstelle_bau" | "unknown">, number> = {
    heizung: 0,
    lueftung: 0,
    sanitaer: 0,
    elektro: 0,
    msr: 0,
    bau: 0,
  };

  for (const fid of TECH_FAMILIES) {
    scores[fid] = scoreFamily(t, fid);
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  if (totalScore === 0) return "unknown";

  const matchingFamilies = (TECH_FAMILIES as readonly TechnicalFamilyId[]).filter(
    (f) => scores[f as keyof typeof scores] >= MIN_SCORE_THRESHOLD
  );

  const strongTechFamilies = (TECH_FAMILIES as readonly TechnicalFamilyId[]).filter(
    (f) => f !== "bau" && scores[f as keyof typeof scores] >= MIN_STRONG_SCORE_FOR_CONFLICT
  );
  const hasStrongBau = scores.bau >= MIN_STRONG_SCORE_FOR_CONFLICT;
  const hasBau = matchingFamilies.includes("bau");

  if (type === "bauseits_other_trade") {
    if (countTechFamiliesWithScore(scores, 0.5) >= 2 || hasStrongBau) return "schnittstelle_bau";
    if (matchingFamilies.length >= 1) return "schnittstelle";
    return "schnittstelle";
  }

  if (type === "coordination_interface") {
    if (strongTechFamilies.length >= 2 && hasStrongBau) return "schnittstelle_bau";
    if (strongTechFamilies.length >= 2 && allowsSchnittstelle(type)) return "schnittstelle";
    if (strongTechFamilies.length === 1) return strongTechFamilies[0];
    if (matchingFamilies.length === 1) return matchingFamilies[0];
    if (matchingFamilies.length === 0) return "unknown";
    if (strongTechFamilies.length >= 2) return "schnittstelle";
  }

  if (strongTechFamilies.length >= 2 && hasStrongBau && allowsSchnittstelle(type)) return "schnittstelle_bau";
  if (strongTechFamilies.length >= 2 && allowsSchnittstelle(type)) return "schnittstelle";
  if (hasStrongBau && strongTechFamilies.length === 1) return "schnittstelle_bau";
  if (matchingFamilies.length === 1) return matchingFamilies[0];
  if (matchingFamilies.length > 1 && allowsSchnittstelle(type)) return "schnittstelle";
  if (matchingFamilies.length > 1) {
    const bestFamily = (TECH_FAMILIES as readonly TechnicalFamilyId[]).reduce((a, b) =>
      scores[a as keyof typeof scores] >= scores[b as keyof typeof scores] ? a : b
    );
    return bestFamily;
  }

  const bestFamily = (TECH_FAMILIES as readonly TechnicalFamilyId[]).reduce((a, b) =>
    scores[a as keyof typeof scores] >= scores[b as keyof typeof scores] ? a : b
  );
  return scores[bestFamily as keyof typeof scores] > 0 ? bestFamily : "unknown";
}

export type FamilyResolveDebug = {
  family: TechnicalFamilyId;
  scores: Record<string, number>;
  unknownReason?: "no_family_keywords" | "only_weak_ambiguous_hits" | "no_technical_context";
};

/**
 * Wie resolveFamilyFromText, aber mit Scores und unknownReason für Debug.
 */
export function resolveFamilyFromTextWithDebug(
  text: string,
  claimGapType?: ClaimGapType
): FamilyResolveDebug {
  const t = (text ?? "").trim();
  const type = claimGapType ?? "none";
  const scores: Record<string, number> = {
    heizung: 0,
    lueftung: 0,
    sanitaer: 0,
    elektro: 0,
    msr: 0,
    bau: 0,
  };

  if (t.length < 5) {
    return { family: "unknown", scores, unknownReason: "no_technical_context" };
  }

  for (const fid of TECH_FAMILIES) {
    scores[fid as string] = scoreFamily(t, fid);
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  if (totalScore === 0) {
    return { family: "unknown", scores, unknownReason: "no_family_keywords" };
  }

  const matchingFamilies = (TECH_FAMILIES as readonly TechnicalFamilyId[]).filter(
    (f) => scores[f as string] >= MIN_SCORE_THRESHOLD
  );
  const strongTechFamilies = (TECH_FAMILIES as readonly TechnicalFamilyId[]).filter(
    (f) => f !== "bau" && scores[f as string] >= MIN_STRONG_SCORE_FOR_CONFLICT
  );

  const family = resolveFamilyFromText(text, claimGapType);
  if (family !== "unknown") {
    return { family, scores };
  }

  let unknownReason: FamilyResolveDebug["unknownReason"] = "only_weak_ambiguous_hits";
  if (totalScore === 0) unknownReason = "no_family_keywords";
  return { family: "unknown", scores, unknownReason };
}

export function getNachtragFamily(id: NachtragFamilyId): NachtragFamily {
  return FAMILIES[id];
}

/** Legacy: für Trigger-basierte Quellen (z.B. adapterFromLegacy). Nutzt Trigger-Name/Category als Text. */
export function resolveFamilyFromTrigger(triggerName?: string | null, category?: string | null): NachtragFamilyId {
  const text = [triggerName ?? "", category ?? ""].filter(Boolean).join(" ");
  return resolveFamilyFromText(text);
}
