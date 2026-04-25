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
  debug?: {
    disciplineScores: Record<Exclude<DisciplineKey, "global">, number>;
    matchedSignals: Record<Exclude<DisciplineKey, "global">, string[]>;
    filenameSignals: Record<Exclude<DisciplineKey, "global">, string[]>;
    normSignals: Record<Exclude<DisciplineKey, "global">, string[]>;
    titleSignals: Record<Exclude<DisciplineKey, "global">, string[]>;
    positionSignals: Record<Exclude<DisciplineKey, "global">, string[]>;
    dampenedSignals: Record<Exclude<DisciplineKey, "global">, string[]>;
    primaryDiscipline: DisciplineKey | null;
    secondaryDiscipline: DisciplineKey[];
    finalReason: string;
  };
};

type DetectContext = {
  fileName?: string;
  projectName?: string;
  positions?: string;
  vortext?: string;
};

type DisciplineScoreKey = Exclude<DisciplineKey, "global">;

const DISCIPLINE_KEYS: DisciplineScoreKey[] = ["heizung", "sanitaer", "lueftung", "msr", "elektro", "kaelte"];

function emptySignals(): Record<DisciplineScoreKey, string[]> {
  return {
    heizung: [],
    sanitaer: [],
    lueftung: [],
    msr: [],
    elektro: [],
    kaelte: [],
  };
}

function uniqPush(arr: string[], value: string) {
  if (!arr.includes(value)) arr.push(value);
}

export function detectDisciplines(lvText: string, ctx: DetectContext = {}): DisciplineDetect {
  const t = (lvText || "").toLowerCase();
  const fileName = (ctx.fileName ?? "").toLowerCase();
  const projectName = (ctx.projectName ?? "").toLowerCase();
  const positions = (ctx.positions ?? "").toLowerCase();
  const vortext = (ctx.vortext ?? "").toLowerCase();
  const firstChunk = t.slice(0, Math.max(1200, Math.floor(t.length * 0.2)));

  const scores: Record<DisciplineScoreKey, number> = {
    heizung: 0,
    sanitaer: 0,
    lueftung: 0,
    msr: 0,
    elektro: 0,
    kaelte: 0,
  };
  const matchedSignals = emptySignals();
  const filenameSignals = emptySignals();
  const normSignals = emptySignals();
  const titleSignals = emptySignals();
  const positionSignals = emptySignals();
  const dampenedSignals = emptySignals();
  const msrStrongSignals = emptySignals();
  const lueftungStrongSignals = emptySignals();

  const addSignal = (
    key: DisciplineScoreKey,
    weight: number,
    signal: string,
    bucket: Record<DisciplineScoreKey, string[]>,
    opts?: { strongMsr?: boolean; strongLueftung?: boolean }
  ) => {
    scores[key] += weight;
    uniqPush(bucket[key], signal);
    uniqPush(matchedSignals[key], signal);
    if (opts?.strongMsr) uniqPush(msrStrongSignals[key], signal);
    if (opts?.strongLueftung) uniqPush(lueftungStrongSignals[key], signal);
  };

  const filenameRules: Array<{ key: DisciplineScoreKey; re: RegExp; signal: string; weight: number }> = [
    { key: "lueftung", re: /(^|[_\-\s])lu(e)?([_\-\s]|$)|\blü\b|\brlt\b/i, signal: "filename:LU/LUE/LÜ/RLT", weight: 10 },
    { key: "heizung", re: /(^|[_\-\s])hz([_\-\s]|$)|\bheiz/i, signal: "filename:HZ/HEIZ", weight: 9 },
    { key: "sanitaer", re: /\bsan\b|\bsh\b|\btw\b|\baw\b/i, signal: "filename:SAN/SH/TW/AW", weight: 8 },
    { key: "elektro", re: /\belt\b|\belektro\b/i, signal: "filename:ELT/ELEKTRO", weight: 8 },
    { key: "msr", re: /\bmsr\b|\bga\b|\bglt\b/i, signal: "filename:MSR/GA/GLT", weight: 8 },
  ];
  for (const rule of filenameRules) {
    if (rule.re.test(fileName)) addSignal(rule.key, rule.weight, rule.signal, filenameSignals);
  }

  const normRules: Array<{ key: DisciplineScoreKey; re: RegExp; signal: string; weight: number; strongL?: boolean; strongM?: boolean }> = [
    { key: "lueftung", re: /\b(atv\s*)?din\s*18379\b/gi, signal: "norm:DIN 18379", weight: 12, strongL: true },
    { key: "lueftung", re: /\bvdi\s*6022\b/gi, signal: "norm:VDI 6022", weight: 10, strongL: true },
    { key: "heizung", re: /\b(atv\s*)?din\s*18380\b/gi, signal: "norm:DIN 18380", weight: 10 },
    { key: "sanitaer", re: /\b(atv\s*)?din\s*18381\b/gi, signal: "norm:DIN 18381", weight: 10 },
    { key: "elektro", re: /\b(atv\s*)?din\s*18382\b/gi, signal: "norm:DIN 18382", weight: 10 },
    { key: "msr", re: /\b(atv\s*)?din\s*18386\b/gi, signal: "norm:DIN 18386", weight: 10, strongM: true },
  ];
  for (const rule of normRules) {
    const hits = t.match(rule.re)?.length ?? 0;
    if (hits > 0) {
      addSignal(
        rule.key,
        Math.min(4, hits) * rule.weight,
        `${rule.signal} x${hits}`,
        normSignals,
        { strongLueftung: !!rule.strongL, strongMsr: !!rule.strongM }
      );
    }
  }

  const titleText = `${projectName}\n${firstChunk.slice(0, 6000)}`;
  const positionText = `${positions}\n${vortext}`;
  const scanRules: Array<{ key: DisciplineScoreKey; re: RegExp; signal: string; titleW: number; posW: number; strongL?: boolean; strongM?: boolean }> = [
    { key: "lueftung", re: /\brlt\b|\braumlufttechn/i, signal: "luft:RLT/Raumlufttechnik", titleW: 7, posW: 4, strongL: true },
    { key: "lueftung", re: /\bl[üu]ftungsanlage(n)?\b|\bzentrale\s+l[üu]ftungsanlage|\bdezentrale\s+l[üu]ftungsanlage/gi, signal: "luft:Lüftungsanlage", titleW: 7, posW: 4, strongL: true },
    { key: "lueftung", re: /\bluftkanal|\bluftleitung|\bzuluft|\babluft|\bfortluft|\bau[ßs]enluft/gi, signal: "luft:Kanal/Luftarten", titleW: 6, posW: 3, strongL: true },
    { key: "lueftung", re: /\bventilator|\bbrandschutzklappe|\bluftausl[aä]ss(e|en)?|\bvolumenstromregler|\bvvs-?regelger[aä]te/gi, signal: "luft:Komponenten", titleW: 5, posW: 3, strongL: true },
    { key: "lueftung", re: /\beinregulierung\b.*\bl[üu]ftungstechnisch|\bhygieneinspektion\b/gi, signal: "luft:Betrieb/Hygiene", titleW: 5, posW: 3, strongL: true },

    { key: "msr", re: /\bgeb[aä]udeautomation|\bglt\b|\bddc\b|\bautomationsstation|\bbacnet\b|\bregelschema\b|\bfunktionsliste\b|\bdatenpunkte\b|\be\/a-?module\b|\bcontroller\b|\bmanagementbedienebene\b/gi, signal: "msr:GA-Schwerpunkt", titleW: 8, posW: 5, strongM: true },
    { key: "msr", re: /\bmsr-?technik\b|\bmsr\b|\bga\b/gi, signal: "msr:MSR/GA-Titel", titleW: 7, posW: 4, strongM: true },

    { key: "heizung", re: /\bheizung|\bheizkreis|\bw[aä]rmepumpe|\bkessel/gi, signal: "heizung:Basis", titleW: 4, posW: 2 },
    { key: "sanitaer", re: /\bsanit[aä]r|\btrinkwasser|\babwasser|\bwc\b|\burinal/gi, signal: "sanitaer:Basis", titleW: 4, posW: 2 },
    { key: "elektro", re: /\belektro|\bverteiler|\bkabel|\bschutzschalter/gi, signal: "elektro:Basis", titleW: 4, posW: 2 },
    { key: "kaelte", re: /\bk[aä]lte|\bk[üu]hlung|\bk[aä]ltemittel/gi, signal: "kaelte:Basis", titleW: 4, posW: 2 },
  ];

  for (const rule of scanRules) {
    const tHits = titleText.match(rule.re)?.length ?? 0;
    const pHits = positionText.match(rule.re)?.length ?? 0;
    if (tHits > 0) {
      addSignal(rule.key, Math.min(6, tHits) * rule.titleW, `${rule.signal} (title x${tHits})`, titleSignals, {
        strongLueftung: !!rule.strongL,
        strongMsr: !!rule.strongM,
      });
    }
    if (pHits > 0) {
      addSignal(rule.key, Math.min(10, pHits) * rule.posW, `${rule.signal} (position x${pHits})`, positionSignals, {
        strongLueftung: !!rule.strongL,
        strongMsr: !!rule.strongM,
      });
    }
  }

  const msrComponentHits =
    (t.match(/\bregelung\b/g)?.length ?? 0) +
    (t.match(/\bansteuerung\b/g)?.length ?? 0) +
    (t.match(/\bco2-?f[üu]hler\b/g)?.length ?? 0) +
    (t.match(/\bschaltschrank\b/g)?.length ?? 0) +
    (t.match(/\b0-?10v\b/g)?.length ?? 0);
  if (msrComponentHits > 0) {
    const dampWeight = Math.min(15, msrComponentHits * 0.8);
    scores.msr += dampWeight;
    uniqPush(dampenedSignals.msr, `msr:Komponentensignale x${msrComponentHits} (gedämpft)`);
    uniqPush(matchedSignals.msr, `msr:Komponentensignale x${msrComponentHits}`);
  }

  const lueftungStrongCount = lueftungStrongSignals.lueftung.length;
  const msrStrongCount = msrStrongSignals.msr.length;
  if (lueftungStrongCount >= 2 && msrStrongCount === 0 && scores.msr > 0) {
    const before = scores.msr;
    scores.msr = scores.msr * 0.45;
    uniqPush(dampenedSignals.msr, `dominanz:MSR reduziert (${before.toFixed(1)}→${scores.msr.toFixed(1)}) wegen Lüftungsdominanz`);
  }

  const MIN_HITS = 3;
  const ordered = (Object.keys(scores) as DisciplineScoreKey[])
    .filter((k) => scores[k] >= MIN_HITS)
    .sort((a, b) => scores[b] - scores[a]);

  let primary = ordered.length ? (ordered[0] as DisciplineKey) : null;
  let finalReason = "max_score";
  if (scores.lueftung >= MIN_HITS && scores.lueftung >= scores.msr * 1.2 && lueftungStrongCount > 0) {
    primary = "lueftung";
    finalReason = "lueftung_dominance_with_strong_signals";
  }

  const secondary =
    primary
      ? (ordered
          .filter((k) => k !== primary && scores[k] >= Math.ceil(scores[primary as Exclude<DisciplineKey, "global">] * 0.6))
          .map((k) => k as DisciplineKey) as DisciplineKey[])
      : [];

  const all = primary ? [primary, ...secondary] : [];
  return {
    primary,
    secondary,
    all,
    scores,
    debug: {
      disciplineScores: scores,
      matchedSignals,
      filenameSignals,
      normSignals,
      titleSignals,
      positionSignals,
      dampenedSignals,
      primaryDiscipline: primary,
      secondaryDiscipline: secondary,
      finalReason,
    },
  };
}
