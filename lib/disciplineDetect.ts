/**
 * Gewerke-Erkennung für Trigger-Filterung (wie in /api/score).
 * Zentral, damit Vortext-Risiko und Score dieselbe Heuristik nutzen können.
 */

export type DisciplineKey = "heizung" | "sanitaer" | "lueftung" | "msr" | "elektro" | "kaelte" | "global";

export type DisciplineDetect = {
  primary: DisciplineKey | null;
  secondary: DisciplineKey[];
  all: DisciplineKey[];
  scores: Record<Exclude<DisciplineKey, "global">, number>;
};

function countHits(t: string, re: RegExp) {
  const m = t.match(re);
  return m ? m.length : 0;
}

export function detectDisciplines(lvText: string): DisciplineDetect {
  const t = (lvText || "").toLowerCase();

  const scores: Record<Exclude<DisciplineKey, "global">, number> = {
    heizung: 0,
    sanitaer: 0,
    lueftung: 0,
    msr: 0,
    elektro: 0,
    kaelte: 0,
  };

  scores.heizung += countHits(
    t,
    /\bheizung\b|\bheizkreis\b|\bheizkörper\b|\bfussbodenheizung\b|\bfbh\b|\bwärmepumpe\b|\bwaermepumpe\b|\bkessel\b|\bbrennwert\b|\bpuffer\b|\bspeicher\b|\bhydraulik\b|\bmischer\b|\bweiche\b|\bvorlauf\b|\br(ü|ue)cklauf\b|\bheizlast\b|\bdin\s*en\s*12831\b/g
  );

  scores.sanitaer += countHits(
    t,
    /\bsanit(ä|ae)r\b|\btrinkwasser\b|\bwarmwasser\b|\bkaltwasser\b|\bzirkulation\b|\bzirkulationsleitung\b|\barmatur\b|\bwc\b|\burinal\b|\bwaschtisch\b|\bdusche\b|\bbadewanne\b|\babwass/g
  );
  scores.sanitaer += countHits(
    t,
    /\bentw(ä|ae)sser\b|\bfallleitung\b|\bdin\s*1988\b|\bdin\s*1986\b|\bdin\s*en\s*1717\b|\bdin\s*en\s*806\b|\bdin\s*en\s*12056\b/g
  );

  scores.lueftung += countHits(
    t,
    /\bl(ü|ue)ftung\b|\brlt\b|\bvolumenstrom\b|\bkanal\b|\bluftkanal\b|\bluftmenge\b|\bbrandschutzklappe\b|\bvav\b/g
  );

  scores.msr += countHits(
    t,
    /\bmsr\b|\bga\b|\bgeb(ä|ae)udeautomation\b|\bregelung\b|\bddc\b|\bbacnet\b|\bmodbus\b|\bknx\b|\bbus\b/g
  );

  scores.elektro += countHits(
    t,
    /\belektro\b|\belt\b|\bstrom\b|\bverteiler\b|\bkabel\b|\bleitung\b|\bschutzschalter\b|\bfi\b|\brccb\b|\bls\b|\bpotentialausgleich\b/g
  );

  scores.kaelte += countHits(
    t,
    /\bk(ä|ae)lte\b|\bk(ä|ae)ltemittel\b|\bchiller\b|\bk(ü|ue)hlung\b|\bverdampfer\b|\bverfl(ü|ue)ssiger\b/g
  );

  const MIN_HITS = 3;

  const HEIZUNG_DECISIVE_COMPOUND =
    /\bheizungsarbeiten\b|\bheizungstechnik\b|\bheizungsanlage\b|\bheizungsinstallateur\b|\bheizungsmontage\b/gi;
  const decisiveHeizungMatches = (t.match(HEIZUNG_DECISIVE_COMPOUND) ?? []).length;
  if (decisiveHeizungMatches > 0) {
    scores.heizung = Math.max(scores.heizung + decisiveHeizungMatches, MIN_HITS);
  }

  const ordered = (Object.keys(scores) as Array<Exclude<DisciplineKey, "global">>)
    .filter((k) => scores[k] >= MIN_HITS)
    .sort((a, b) => scores[b] - scores[a]);

  let primary = ordered.length ? (ordered[0] as DisciplineKey) : null;

  const elektroHits = scores.elektro;
  const sanitaerHits = scores.sanitaer;
  const hasStrongNotstromSignals = /\b(notstrom|usv|netzersatz|dieselaggregat|notstromaggregat)\b/i.test(lvText);
  if (
    hasStrongNotstromSignals &&
    elektroHits >= MIN_HITS &&
    elektroHits >= sanitaerHits &&
    primary !== "elektro"
  ) {
    primary = "elektro";
  }

  const secondary =
    primary
      ? (ordered
          .filter((k) => k !== primary && scores[k] >= Math.ceil(scores[primary as Exclude<DisciplineKey, "global">] * 0.6))
          .map((k) => k as DisciplineKey) as DisciplineKey[])
      : [];

  const all = primary ? [primary, ...secondary] : [];

  return { primary, secondary, all, scores };
}
