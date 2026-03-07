/**
 * Zentrale Text-Konfiguration für kundenfreundliche Bezeichnungen,
 * Erklärungstexte, Rückfragen und Angebotsklarstellungen.
 *
 * customerUI: kundenrelevante Oberfläche (/analyse).
 * explanation: Erklärungstexte der Tabs.
 * rueckfragen / angebotsklarstellungen: Bereichs-Texte.
 * internal: Kategorien, Schweregrade, KeyFacts (auch in Analyse sichtbar).
 */

export type TextsConfig = {
  customerUI: {
    tabLabels: Record<string, string>;
    tabDescriptionUebersicht: string;
    kpiLabels: Record<string, string>;
    sectionHeaders: Record<string, string>;
    buttonLabels: Record<string, string>;
    /** Ampel-Farbbezeichnungen und Legende (Übersicht/Transparenz). */
    ampel: { green: string; yellow: string; red: string };
    ampelLegend: string;
    /** Leer-/Fehlerzustände (kundenrelevant). */
    emptyStates: Record<string, string>;
  };
  explanation: {
    risiken: string;
    nachtragspotenzial: string;
    rueckfragen: string;
    angebotsklarstellungen: string;
    transparenz: string;
    scoreCalculation: string;
  };
  rueckfragen: {
    emptyState: string;
    generateButton: string;
    generateButtonLoading: string;
    groupLabels: Record<string, string>;
    debugTitle: string;
  };
  angebotsklarstellungen: {
    emptyState: string;
    generateButton: string;
    generateButtonLoading: string;
    loadingMessage: string;
    groupLabels: Record<string, string>;
    debugTitle: string;
  };
  internal: {
    categoryLabels: Record<string, string>;
    severityLabels: Record<string, string>;
    keyFactLabels: Record<string, string>;
  };
};

export const DEFAULT_TEXTS_CONFIG: TextsConfig = {
  customerUI: {
    tabLabels: {
      uebersicht: "Übersicht",
      risiken: "Risiken",
      nachtragspotenzial: "Nachtragspotenzial",
      rueckfragen: "Rückfragen",
      angebotsklarstellungen: "Angebotsklarstellungen",
      trigger: "Trigger",
      risikodetails: "Risikodetails",
      transparenz: "Transparenz",
    },
    tabDescriptionUebersicht: "Entscheidungs-Dashboard mit Gesamt-Risiko, Ampel und Top-Befunden.",
    kpiLabels: {
      complexity: "Komplexität",
      totalRisk: "Gesamt-Risiko",
      claimPotential: "Claim-Potenzial",
      riskAmpelCategories: "Risiko-Ampel der Kategorien",
      riskAmpelJeKategorie: "Risiko-Ampel je Kategorie",
      topFindings: "Top Findings",
    },
    sectionHeaders: {
      projektdaten: "Projektdaten aus dem Leistungsverzeichnis",
      projektdatenSub: "Wichtige Angaben aus der Einleitung (z. B. Objekt, Vergabeart), automatisch erkannt.",
      risikenVortext: "Risiken im Einleitungstext",
      risikenVortextSub: "Künstliche Intelligenz analysiert den Vortext des Leistungsverzeichnisses und erkennt mögliche Risiken oder unklare Leistungsbeschreibungen.",
      rueckfragenBlock: "RÜCKFRAGEN / KLARSTELLUNGEN",
      angebotsBlock: "ANGEBOTS-ANNAHMEN",
      scoreErklaerung: "Erklärung der Score-Berechnung",
    },
    buttonLabels: {
      rueckfragenGenerieren: "Rückfragen generieren",
      annahmenGenerieren: "Annahmen generieren",
      nachtragspotenzialErmitteln: "Nachtragspotenziale ermitteln",
      nachtragspotenzialErmittelnLoading: "Analysiere…",
    },
    ampel: { green: "Grün", yellow: "Gelb", red: "Rot" },
    ampelLegend: "Ampel: 0–39 Grün • 40–69 Gelb • 70–100 Rot",
    emptyStates: {
      noTreffer: "Keine Treffer.",
      noProjektdaten: "Keine Projektdaten gefunden.",
      noRisikoformulierungen: "Keine auffälligen Risikoformulierungen erkannt.",
      noNachtragspotenziale: "Keine Nachtragspotenziale erkannt.",
    },
  },
  explanation: {
    risiken:
      "In diesem Bereich werden mögliche Risiken im Leistungsverzeichnis dargestellt: unklare Leistungsbeschreibungen, fehlende Angaben, widersprüchliche oder mehrdeutige Formulierungen. Dazu zählen automatisch erkannte Projektdaten aus der Einleitung sowie vom System und von der KI identifizierte Risikostellen im Text. Eine systematische Prüfung dieser Punkte hilft, Nachforderungen und Streitigkeiten in der Ausführung zu reduzieren.",
    nachtragspotenzial:
      "Dieser Bereich zeigt mögliche Ursachen für spätere Nachträge oder zusätzliche Kosten während der Bauausführung. Unklare Leistungsgrenzen, fehlende Schnittstellendefinitionen oder nicht beschriebene Erschwernisse können zu Nachforderungen führen. Die Analyse nutzt die erkannten Risiken und Projektdaten, um solche Treiber zu identifizieren. So können Sie früh gegensteuern oder im Angebot entsprechende Annahmen und Klarstellungen formulieren.",
    rueckfragen:
      "Die hier generierten Fragen sollten vor Angebotsabgabe mit dem Planer oder Auftraggeber geklärt werden. Sie basieren auf den erkannten Risiken, unklaren Formulierungen und fehlenden Projektdaten im Leistungsverzeichnis. Eine rechtzeitige Klärung reduziert das Risiko von Nachträgen und Streitigkeiten und ermöglicht ein kalkuliertes, abgesichertes Angebot.",
    angebotsklarstellungen:
      "Diese Textbausteine können im Angebot verwendet werden, um Leistungsgrenzen, Annahmen oder Auslegungen klar zu stellen. Sie leiten sich aus den erkannten Risiken und Ihren Rückfragen ab und helfen, den Angebotsumfang rechtssicher zu definieren. So können Sie Nachforderungen vermeiden, die aus unklaren oder fehlenden Angaben im Leistungsverzeichnis entstehen.",
    transparenz:
      "Hier wird erklärt, wie die Bewertung des Leistungsverzeichnisses berechnet wurde. Der Risiko-Score und die Kategorien basieren auf festen Regeln und optional der KI-Auswertung. So können Sie die Aussagekraft der Analyse besser einordnen und bei Bedarf gezielt nachhaken.",
    scoreCalculation:
      "So wird Ihr Risiko-Score berechnet: Der Gesamt-Risiko-Score (0–100) ergibt sich aus den fünf Kategorien: Vertrags-/LV-Risiken, Mengen & Massenermittlung, Technische Vollständigkeit, Schnittstellen & Nebenleistungen, Kalkulationsunsicherheit. Je Kategorie werden Abzüge aus erkannten Risiken (Regeln, Systemprüfung, optional KI) angerechnet. Die Ampel bewertet: 0–39 Grün (solide), 40–69 Gelb (mittel), 70–100 Rot (hohes Risiko). Größenfaktor und Easing können die Kategorien-Bewertung modulieren.",
  },
  rueckfragen: {
    emptyState:
      "Klicke „Rückfragen generieren\", um aus erkannten Risiken, Risiken im Einleitungstext und fehlenden Projektdaten strukturierte Bieterfragen zu erzeugen.",
    generateButton: "Rückfragen generieren",
    generateButtonLoading: "Generiere…",
    groupLabels: {
      technisch: "Technische Fragen",
      vertraglich: "Vertragsfragen",
      terminlich: "Terminliche Fragen",
    },
    debugTitle: "Verknüpfung: Quelle → Rückfrage",
  },
  angebotsklarstellungen: {
    emptyState:
      "Klicke „Annahmen generieren\", um aus erkannten Risiken, Rückfragen und Projektdaten Angebotsannahmen zu erzeugen. Optional: zuerst Rückfragen generieren für bessere Verknüpfung.",
    generateButton: "Annahmen generieren",
    generateButtonLoading: "Arbeite…",
    loadingMessage: "Annahmen werden erzeugt… (KI-Optimierung kann einige Sekunden dauern)",
    groupLabels: {
      technisch: "Technische Annahmen",
      vertraglich: "Vertragliche Annahmen",
      terminlich: "Terminliche Annahmen",
    },
    debugTitle: "Verknüpfung: Risiko → Frage → Annahme",
  },
  internal: {
    categoryLabels: {
      vertrags_lv_risiken: "Vertrags-/LV-Risiken",
      mengen_massenermittlung: "Mengen & Massenermittlung",
      technische_vollstaendigkeit: "Technische Vollständigkeit",
      schnittstellen_nebenleistungen: "Schnittstellen & Nebenleistungen",
      kalkulationsunsicherheit: "Kalkulationsunsicherheit",
    },
    severityLabels: {
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig",
    },
    keyFactLabels: {
      objekt: "Objekt / Projekt",
      vergabeart: "Vergabeart",
      baubeginn: "Baubeginn",
      bauzeit: "Bauzeit / Dauer",
      fertigstellung: "Fertigstellung / Abnahme",
      fristAngebot: "Angebotsfrist",
      vertragsgrundlagen: "Vertragsgrundlagen",
      zahlungsbedingungen: "Zahlungsbedingungen",
      preisgleitung: "Preisgleitklausel / Rohstoffpreise",
    },
  },
};
