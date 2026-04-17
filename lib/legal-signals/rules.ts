import type { LegalSignalRuleDef } from "./types";

/**
 * V1: bewusst einfache Muster – erweiterbar, keine Vollständigkeit.
 * Negative Patterns reduzieren False Positives bei sehr generischen Treffern.
 */
export const LEGAL_SIGNAL_RULES: LegalSignalRuleDef[] = [
  // --- unusual_risk_transfer ---
  {
    ruleId: "ur_001",
    signalType: "unusual_risk_transfer",
    patterns: [
      /vollständigen?\s+funktion\s+erforderlichen?\s+leistungen/gi,
      /alle\s+zur\s+.*funktion.*erforderlich/gi,
      /auch\s+wenn\s+nicht\s+ausdrücklich\s+beschrieben/gi,
      /nicht\s+ausdrücklich\s+aufgeführt.*dennoch/gi,
      /vollständigkeit.*selbst\s+zu\s+prüfen/gi,
      /bieter.*vollständigkeit.*verantwortung/gi,
      /pauschale\s+gesamtverantwortung/gi,
    ],
    title: "Weitreichende Leistungs- oder Vollständigkeitspflichten",
    summary:
      "Der Text weitet den Leistungsumfang stark aus (z. B. pauschale Vollständigkeit). Das kann zu Mehraufwand und Streit führen, was im Angebot nicht mit abgebildet ist.",
    recommendedAction:
      "Leistungsumfang und Vollständigkeitsklauseln vor Angebotsabgabe schriftlich eingrenzen.",
    baseSeverity: "medium",
    affectsCategories: ["vertrags_lv_risiken", "kalkulationsunsicherheit"],
    scoreDeltaHint: { vertrags_lv_risiken: 1.5, kalkulationsunsicherheit: 1.5 },
    suggestedQuestion:
      "Welche Leistungen sind trotz pauschaler Vollständigkeitsklauseln eindeutig im Leistungsumfang enthalten bzw. ausgeschlossen?",
    suggestedClarification:
      "Wir gehen davon aus, dass nur ausdrücklich beschriebene Leistungen geschuldet sind; pauschale Vollständigkeitsklauseln sind vor Angebotsabgabe konkret zu benennen.",
  },
  {
    ruleId: "ur_002",
    signalType: "unusual_risk_transfer",
    patterns: [
      /ohne\s+zusätzliche\s+vergütung/gi,
      /unentgeltlich\s+zu\s+erbringen/gi,
      /unentgeltlich\s+(nachzuweisen|bereitzustellen|einzubringen|einzureichen)/gi,
      /nicht\s+besonders\s+verg(ü|ue)tet/gi,
      /im\s+angebotspreis\s+mit\s+abgedeckt/gi,
    ],
    negativePatterns: [/nicht\s+verlangt/gi],
    title: "Preis deckt mehr ab als klar beschrieben",
    summary:
      "Es klingt so, als soll der Angebotspreis auch nicht ausdrücklich genannte Leistungen abdecken. Zusatzaufwände lassen sich schwer kalkulieren und verteidigen.",
    recommendedAction:
      "Preisumfang und mögliche Zusatzleistungen im Angebot klar abgrenzen.",
    baseSeverity: "low",
    affectsCategories: ["vertrags_lv_risiken", "kalkulationsunsicherheit"],
    scoreDeltaHint: { vertrags_lv_risiken: 1, kalkulationsunsicherheit: 1 },
    suggestedQuestion: "Welche Leistungen sind im Angebotspreis eindeutig enthalten; welche wären als Zusatzleistung zu bewerten?",
    suggestedClarification:
      "Wir gehen davon aus, dass nur die ausdrücklich beschriebenen Positionen im Preis enthalten sind; weitere Leistungen wären gesondert zu bewerten.",
  },

  // --- acceptance_documentation_risk ---
  {
    ruleId: "ad_001",
    signalType: "acceptance_documentation_risk",
    patterns: [
      /nachweis.*vollständig/gi,
      /funktionsnachweis/gi,
      /abnahme.*voraussetzung/gi,
      /dokumentation.*vollständig/gi,
      /einweisung.*nachweis/gi,
      /prüflast.*auftragnehmer/gi,
      /abnahme.*erst\s+nach/gi,
      /f(ö|oe)rderf(ä|ae)higkeit/gi,
      /nachweis.*unentgeltlich/gi,
    ],
    title: "Nachweise, Abnahme oder Dokumentation stark betont",
    summary:
      "Es fallen viele Nachweise, Prüfungen oder Abnahmeschritte an, ohne dass klar ist, wer was wann liefert. Das kostet Zeit und kann den Abschluss verzögern.",
    recommendedAction:
      "Dokumentations- und Abnahmeumfang konkretisieren; wer liefert Nachweise und Freigaben.",
    baseSeverity: "medium",
    affectsCategories: ["vertrags_lv_risiken", "kalkulationsunsicherheit", "technische_vollstaendigkeit"],
    scoreDeltaHint: { vertrags_lv_risiken: 1, kalkulationsunsicherheit: 1.5, technische_vollstaendigkeit: 0.8 },
    suggestedQuestion:
      "Welche Nachweise, Einweisungen und Abnahmeschritte sind verbindlich; wer stellt Vorleistungen und Freigaben bereit?",
    suggestedClarification:
      "Wir gehen davon aus, dass Abnahme und Nachweise nur nach den vertraglich genannten, erfüllbaren Voraussetzungen erfolgen.",
  },

  // --- hindrance_dependency_risk ---
  {
    ruleId: "hd_001",
    signalType: "hindrance_dependency_risk",
    patterns: [
      /\bbauseits\b/gi,
      /durch\s+(den\s+)?auftraggeber\s+bereitzustellen/gi,
      /nach\s+freigabe/gi,
      /nach\s+vorleistung/gi,
      /anderer\s+gewerk/gi,
      /koordination\s+mit\s+.*gewerk/gi,
      /abhängig\s+von\s+.*(planer|ag|auftraggeber)/gi,
      /vorleistung.*nicht\s+terminsicher/gi,
      /\bzu\s+klären\b/gi,
      /\bbauseitig\b/gi,
      /\bortsbesichtigung\b/gi,
      /zwingend\s+(erforderlich|notwendig|vorgeschrieben)/gi,
      /nach\s+voranmeldung/gi,
      /in\s+abstimmung(\s+mit)?/gi,
      /\bmsr\b[\s\S]{0,80}\bbauseit/gi,
    ],
    title: "Abhängigkeit von Vorleistungen oder Dritten",
    summary:
      "Die Leistung hängt erkennbar von bauseitigen Vorleistungen, Freigaben oder anderen Gewerken ab. Das erhöht das Risiko für Behinderungen, Terminverschiebungen und Streit über Zuständigkeiten.",
    recommendedAction:
      "Zuständigkeiten und bauseitige Vorleistungen vor Angebotsabgabe klären.",
    baseSeverity: "medium",
    affectsCategories: ["schnittstellen_nebenleistungen", "vertrags_lv_risiken"],
    scoreDeltaHint: { schnittstellen_nebenleistungen: 2, vertrags_lv_risiken: 1 },
    suggestedQuestion:
      "Welche Vorleistungen, Freigaben und Schnittstellen sind wann und durch wen verbindlich bereitzustellen?",
    suggestedClarification:
      "Wir gehen davon aus, dass Verzögerungen durch fehlende Vorleistungen Dritter nicht ohne Weiteres zugerechnet werden.",
  },

  // --- change_order_potential ---
  {
    ruleId: "co_001",
    signalType: "change_order_potential",
    patterns: [
      /eventualposition/gi,
      /bedarfsposition/gi,
      /unklar(e|en)?\s+mengen/gi,
      /später(e|en)?\s+konkretisierung/gi,
      /nicht\s+abschließend\s+definiert/gi,
      /grob\s+beschrieben/gi,
      /ergänzung(en)?\s+(später|nach)/gi,
      /\bim\s+bedarfsfall\b/gi,
      /sp(ä|ae)ter(e|en)?\s+nachr(ü|ue)st(ung|en|et)?/gi,
      /\beingelager(t|ung)\b/gi,
    ],
    title: "Offene Mengen oder spätere Konkretisierung",
    summary:
      "Mengen, Bedarfs- oder Eventualpositionen sind offen oder werden erst später festgelegt. Das erzeugt Kalkulationsrisiko und oft Nachtragsbedarf.",
    recommendedAction:
      "Leistungsumfang und Nachtragsgrenzen im Angebot absichern; Bedarfspositionen gesondert bewerten.",
    baseSeverity: "medium",
    affectsCategories: ["kalkulationsunsicherheit", "vertrags_lv_risiken"],
    scoreDeltaHint: { kalkulationsunsicherheit: 2, vertrags_lv_risiken: 1 },
    suggestedQuestion:
      "Welche Positionen sind endgültig bemessen; wo sind Nachträge oder Bedarfspositionen zu erwarten?",
    suggestedClarification:
      "Wir gehen davon aus, dass nur die konkret bemessenen Leistungen geschuldet sind; Eventual- und Bedarfspositionen sind gesondert zu bewerten.",
  },
  {
    ruleId: "co_002",
    signalType: "change_order_potential",
    patterns: [
      /schnittstelle.*nicht\s+(abschließend|eindeutig)/gi,
      /leistungsumfang.*offen/gi,
      /anpassung.*bedarf/gi,
      /akzeptiert,?\s+sofern/gi,
    ],
    title: "Offene Schnittstellen oder Leistungsumfänge",
    summary:
      "Schnittstellen oder Umfänge sind nicht abschließend beschrieben. Unklar bleibt, wo Ihre Leistung endet und was später als Zusatz kommt.",
    recommendedAction:
      "Schnittstellen inhaltlich und zeitlich festlegen; Erweiterungen als Zusatzleistung kennzeichnen.",
    baseSeverity: "low",
    affectsCategories: ["kalkulationsunsicherheit", "vertrags_lv_risiken"],
    scoreDeltaHint: { kalkulationsunsicherheit: 1.2, vertrags_lv_risiken: 0.8 },
    suggestedQuestion: "Wie sind Schnittstellen zu benachbarten Gewerken inhaltlich und zeitlich abgegrenzt?",
    suggestedClarification:
      "Wir gehen davon aus, dass Leistungen an Schnittstellen nur nach der vertraglichen Beschreibung umfassen; Erweiterungen sind gesondert.",
  },
  {
    ruleId: "hd_002",
    signalType: "hindrance_dependency_risk",
    patterns: [
      /\bbleibt\b[\s\S]{0,120}\b(in betrieb|betrieben)\b/gi,
      /lagerplatz[\s\S]{0,160}(begrenzt|nur\s+.*\s+verf(ü|ue)gung)/gi,
      /betrieb(s)?restriktion|logistik[\s\S]{0,40}einschr(ä|ae)nkung/gi,
    ],
    title: "Betrieb, Logistik oder Lagerrestriktionen",
    summary:
      "Laufender Betrieb, begrenzter Lagerplatz oder Logistikrestriktionen können Mehraufwand bei Zugang, Zeiten und Hilfsleistungen bedeuten.",
    recommendedAction:
      "Zufuhr, Lager, Betriebszeiten und bauseitige Rahmenbedingungen vor Angebot klären.",
    baseSeverity: "medium",
    affectsCategories: ["schnittstellen_nebenleistungen", "kalkulationsunsicherheit"],
    scoreDeltaHint: { schnittstellen_nebenleistungen: 1.5, kalkulationsunsicherheit: 1.2 },
    suggestedQuestion:
      "Welche Zugänge, Lagerflächen und Betriebsfenster stehen zuverlässig zur Verfügung; wer stellt sie bereit?",
    suggestedClarification:
      "Wir gehen davon aus, dass Einschränkungen durch laufenden Betrieb oder Logistik als Behinderung zu behandeln sind, sofern nicht ausdrücklich anders geregelt.",
  },
  {
    ruleId: "co_003",
    signalType: "change_order_potential",
    patterns: [/\bkostenbeteiligung\b/gi, /zu\s+klären\s+ist/gi, /noch\s+nicht\s+(abschließend|verbindlich)/gi],
    title: "Unklare Kostenverteilung oder ausstehende Festlegungen",
    summary:
      "Kostenbeteiligungen oder ausdrücklich offene Klärungspunkte können spätere Anpassungen, Nachträge oder Zusatzvereinbarungen erzwingen.",
    recommendedAction:
      "Kostenteilung und offene Punkte vor Angebotsabgabe schriftlich festziehen.",
    baseSeverity: "medium",
    affectsCategories: ["kalkulationsunsicherheit", "vertrags_lv_risiken"],
    scoreDeltaHint: { kalkulationsunsicherheit: 1.8, vertrags_lv_risiken: 1 },
    suggestedQuestion: "Wie verteilen sich Kosten für Nachrüstungen, Gemeindewerke oder spätere Ergänzungen verbindlich?",
    suggestedClarification:
      "Wir gehen davon aus, dass unklare Kostenpunkte nicht ohne gesonderte Vereinbarung zu Lasten des AN gehen.",
  },
];
