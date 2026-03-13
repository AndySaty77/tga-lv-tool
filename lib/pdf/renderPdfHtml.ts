/**
 * Rendert ein AnalysisPdfReport als A4-optimiertes HTML.
 * Keine PDF-Bibliothek – nur HTML-String für spätere Generierung.
 * Alle dynamischen Inhalte werden escaped; leere Abschnitte ausgeblendet oder mit Fallback.
 */

import type { AnalysisPdfReport } from "./pdfTypes";
import { reportStyles } from "./reportStyles";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function opt(s: unknown): string {
  if (s == null) return "";
  const t = typeof s === "string" ? s : String(s);
  return t.trim();
}

function trafficLightText(t: "green" | "yellow" | "red"): string {
  if (t === "green") return "Grün (niedrig)";
  if (t === "yellow") return "Gelb (erhöht)";
  if (t === "red") return "Rot (kritisch)";
  return "";
}

/**
 * Erzeugt das vollständige HTML-Dokument für den Report.
 */
export function renderPdfHtml(report: AnalysisPdfReport): string {
  const meta = report.meta ?? {};
  const summary = report.summary ?? {};
  const categoryScores = Array.isArray(report.categoryScores) ? report.categoryScores : [];
  const claimPotential = report.claimPotential;
  const questions = Array.isArray(report.questions) ? report.questions : [];
  const clarifications = Array.isArray(report.clarifications) ? report.clarifications : [];
  const disclaimer = report.disclaimer?.text ?? "";

  const title = escapeHtml(opt(meta.projectName) || opt(meta.sourceFileName) || "Analysebericht");
  const projectLine = [opt(meta.projectName), opt(meta.sourceFileName)].filter(Boolean).map(escapeHtml);
  const analyzedAt = escapeHtml(opt(meta.analyzedAt));

  const executiveSummary = opt(summary.executiveSummary);
  const totalScore = summary.totalScore != null && Number.isFinite(summary.totalScore) ? summary.totalScore : null;
  const totalRiskLabel = opt(summary.totalRiskLabel);
  const complexityScore = summary.complexityScore != null && Number.isFinite(summary.complexityScore) ? summary.complexityScore : null;
  const claimLevel = opt(summary.claimLevel);
  const questionCount = summary.questionCount ?? questions.length;
  const clarificationCount = summary.clarificationCount ?? clarifications.length;

  const parts: string[] = [];

  parts.push(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml("Analysebericht")}</title><style>${reportStyles}</style></head><body><div class="report">`);

  // Seite 1: Titel + Meta + KPI + Summary (kompakt, page-break-inside: avoid)
  parts.push('<div class="page-one-block">');
  parts.push('<div class="report-header">');
  parts.push("<h1>Analysebericht</h1>");
  parts.push('<div class="report-meta">');
  if (projectLine.length > 0) {
    parts.push(`<span>${projectLine.join(" · ")}</span>`);
  }
  if (analyzedAt) {
    parts.push(`<span>Analysiert am ${analyzedAt}</span>`);
  }
  if (opt(meta.projectType)) parts.push(`<span>${escapeHtml(opt(meta.projectType))}</span>`);
  if (opt(meta.companyName)) parts.push(`<span>${escapeHtml(opt(meta.companyName))}</span>`);
  parts.push("</div></div>");

  const hasKpis =
    totalScore != null ||
    totalRiskLabel ||
    complexityScore != null ||
    claimLevel ||
    questionCount > 0 ||
    clarificationCount > 0;
  if (hasKpis) {
    parts.push('<div class="kpi-panel">');
    if (totalScore != null) {
      parts.push(
        '<div class="kpi-card"><div class="kpi-label">Gesamtbewertung</div><div class="kpi-value">' +
          escapeHtml(String(totalScore)) +
          " / 100</div></div>"
      );
    }
    if (totalRiskLabel) {
      parts.push(
        '<div class="kpi-card"><div class="kpi-label">Risikostufe</div><div class="kpi-value">' +
          escapeHtml(totalRiskLabel) +
          "</div></div>"
      );
    }
    if (complexityScore != null) {
      parts.push(
        '<div class="kpi-card"><div class="kpi-label">Komplexität</div><div class="kpi-value">' +
          escapeHtml(String(complexityScore)) +
          "</div></div>"
      );
    }
    if (claimLevel) {
      parts.push(
        '<div class="kpi-card"><div class="kpi-label">Claim-/Nachtragspotenzial</div><div class="kpi-value">' +
          escapeHtml(claimLevel) +
          "</div></div>"
      );
    }
    if (questionCount > 0) {
      parts.push(
        '<div class="kpi-card"><div class="kpi-label">Anzahl Rückfragen</div><div class="kpi-value">' +
          escapeHtml(String(questionCount)) +
          "</div></div>"
      );
    }
    if (clarificationCount > 0) {
      parts.push(
        '<div class="kpi-card"><div class="kpi-label">Anzahl Klarstellungen</div><div class="kpi-value">' +
          escapeHtml(String(clarificationCount)) +
          "</div></div>"
      );
    }
    parts.push("</div>");
  }

  if (executiveSummary) {
    parts.push('<div class="section">');
    parts.push('<h2 class="section-title">Management Summary</h2>');
    parts.push('<div class="summary-block section-body">' + escapeHtml(executiveSummary) + "</div>");
    parts.push("</div>");
  }
  parts.push("</div>"); // .page-one-block

  // Score-Kategorien (nur wenn vorhanden)
  if (categoryScores.length > 0) {
    parts.push('<div class="section">');
    parts.push('<h2 class="section-title">Score-Kategorien</h2>');
    for (const cat of categoryScores) {
      const label = escapeHtml(opt(cat.label) || cat.key);
      const score = cat.score != null && Number.isFinite(cat.score) ? cat.score : null;
      const ampel = cat.trafficLight;
      const reason = opt(cat.shortReason);
      const drivers = Array.isArray(cat.topDrivers) ? cat.topDrivers.filter((d) => opt(d)) : [];
      parts.push('<div class="category-block">');
      parts.push('<div class="cat-label">' + label + "</div>");
      parts.push('<div class="cat-score-line">');
      if (score != null) parts.push(escapeHtml(String(score)) + " Punkte");
      if (ampel) {
        parts.push(
          ' <span class="cat-ampel ' + escapeHtml(ampel) + '">' + escapeHtml(trafficLightText(ampel)) + "</span>"
        );
      }
      parts.push("</div>");
      if (reason) parts.push('<div class="cat-reason">' + escapeHtml(reason) + "</div>");
      if (drivers.length > 0) {
        parts.push("<ul class=\"cat-drivers\">");
        for (const d of drivers) parts.push("<li>" + escapeHtml(opt(d)) + "</li>");
        parts.push("</ul>");
      }
      parts.push("</div>");
    }
    parts.push("</div>");
  }

  // Claim- / Nachtragspotenzial
  if (claimPotential && Object.keys(claimPotential).length > 0) {
    const cpExec = opt(claimPotential.executiveSummary);
    const topRisks = Array.isArray(claimPotential.topRisks) ? claimPotential.topRisks.filter((r) => opt(r)) : [];
    const topNeg = Array.isArray(claimPotential.topNegotiationPoints)
      ? claimPotential.topNegotiationPoints.filter((n) => opt(n))
      : [];
    const actions = Array.isArray(claimPotential.immediateActions)
      ? claimPotential.immediateActions.filter((a) => opt(a))
      : [];
    const finalRec = opt(claimPotential.finalRecommendation);
    const hasClaim = cpExec || topRisks.length > 0 || topNeg.length > 0 || actions.length > 0 || finalRec;
    if (hasClaim) {
      parts.push('<div class="section">');
      parts.push('<h2 class="section-title">Claim- / Nachtragspotenzial</h2>');
      parts.push('<div class="section-body">');
      if (cpExec) parts.push("<p>" + escapeHtml(cpExec) + "</p>");
      if (topRisks.length > 0) {
        parts.push("<p><strong>Top-Risiken</strong></p><ul class=\"claim-list\">");
        for (const r of topRisks) parts.push("<li>" + escapeHtml(opt(r)) + "</li>");
        parts.push("</ul>");
      }
      if (topNeg.length > 0) {
        parts.push("<p><strong>Verhandlungspunkte</strong></p><ul class=\"claim-list\">");
        for (const n of topNeg) parts.push("<li>" + escapeHtml(opt(n)) + "</li>");
        parts.push("</ul>");
      }
      if (actions.length > 0) {
        parts.push("<p><strong>Sofortmaßnahmen</strong></p><ul class=\"claim-list\">");
        for (const a of actions) parts.push("<li>" + escapeHtml(opt(a)) + "</li>");
        parts.push("</ul>");
      }
      if (finalRec) parts.push("<p><strong>Empfehlung</strong></p><p>" + escapeHtml(finalRec) + "</p>");
      parts.push("</div></div>");
    }
  }

  // Rückfragen (nur wenn vorhanden)
  if (questions.length > 0) {
    parts.push('<div class="section">');
    parts.push('<h2 class="section-title">Rückfragen an den Planer</h2>');
    parts.push('<ol class="numbered-list">');
    for (const q of questions) {
      const text = escapeHtml(opt(q.text));
      const title = opt(q.title);
      const priority = q.priority != null ? escapeHtml(String(q.priority)) : "";
      parts.push("<li>");
      if (title) parts.push(escapeHtml(title) + ": ");
      parts.push(text);
      if (priority) parts.push('<span class="priority-tag">Priorität ' + priority + "</span>");
      parts.push("</li>");
    }
    parts.push("</ol>");
    parts.push("</div>");
  }

  // Angebotsklarstellungen (nur wenn vorhanden)
  if (clarifications.length > 0) {
    parts.push('<div class="section">');
    parts.push('<h2 class="section-title">Angebotsklarstellungen</h2>');
    parts.push('<ol class="numbered-list">');
    for (const c of clarifications) {
      const text = escapeHtml(opt(c.text));
      const title = opt(c.title);
      parts.push("<li>");
      if (title) parts.push(escapeHtml(title) + ": ");
      parts.push(text + "</li>");
    }
    parts.push("</ol>");
    parts.push("</div>");
  }

  // Hinweis / Disclaimer (kompakt)
  const disclaimerText = disclaimer && disclaimer.trim() ? disclaimer : "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.";
  parts.push('<div class="disclaimer-box">');
  parts.push("<strong>Hinweis</strong><br/>");
  parts.push(escapeHtml(disclaimerText));
  parts.push("</div>");

  parts.push("</div></body></html>");
  return parts.join("");
}

/**
 * Debug-Hook: Erzeugt aus Mock-Daten ein vollständiges HTML-Dokument.
 * Lokal nutzbar, um das Template zu prüfen, ohne PDF zu bauen.
 * Beispiel: In einer temporären Route oder in der Konsole den Rückgabewert in eine HTML-Datei schreiben und im Browser öffnen.
 */
export function renderPdfHtmlFromMock(): string {
  const mockReport: AnalysisPdfReport = {
    meta: {
      projectName: "Beispielprojekt Musterstraße",
      sourceFileName: "LV_GAEB_2024.xlsx",
      analyzedAt: "06.03.2025",
      projectType: "TGA",
      companyName: "Planungsbüro Beispiel GmbH",
    },
    summary: {
      executiveSummary:
        "Die Ausschreibung weist ein moderates Risikoprofil auf. Schwerpunkte liegen bei Schnittstellen und Mengen. Es werden Rückfragen und Klarstellungen empfohlen.",
      totalScore: 58,
      totalRiskLabel: "Erhöhtes Risiko",
      complexityScore: 72,
      questionCount: 3,
      clarificationCount: 2,
    },
    categoryScores: [
      {
        key: "vertrags_lv_risiken",
        label: "Vertrags- und LV-Risiken",
        score: 65,
        trafficLight: "yellow",
        shortReason: "Einige Klauseln unklar formuliert.",
        topDrivers: ["VOB-Abgrenzung", "Gewährleistungsfristen"],
      },
      {
        key: "mengen_massenermittlung",
        label: "Mengen und Massenermittlung",
        score: 45,
        trafficLight: "yellow",
        topDrivers: ["Massenermittlung Abwasser"],
      },
      {
        key: "technische_vollstaendigkeit",
        label: "Technische Vollständigkeit",
        score: 80,
        trafficLight: "green",
      },
    ],
    claimPotential: {
      executiveSummary: "Nachtragspotenzial vor allem bei Schnittstellen und Mengen.",
      topRisks: ["Abgrenzung Kabelleitungen", "Mengenänderungen bei Änderung der Planung"],
      topNegotiationPoints: ["Pauschalierung Nebenleistungen", "Fristen Inbetriebnahme"],
      immediateActions: ["Rückfrage zu Kabelleitungen stellen", "Mengenannahme dokumentieren"],
      finalRecommendation: "Angebot mit klaren Abgrenzungen und Rückfragen vor Abgabe einreichen.",
    },
    questions: [
      { text: "Sind Kabelleitungen bis zum Zähler in der Ausschreibung enthalten?", priority: "hoch" },
      { title: "Massenermittlung", text: "Gilt die Massenermittlung als verbindlich bei Planungsänderung?" },
    ],
    clarifications: [
      { title: "Abgrenzung", text: "Angebotsannahme: Abgrenzung TGA/ELT wie in LV Abschnitt 2.1." },
      { text: "Nebenleistungen pauschal wie ausgeschrieben." },
    ],
    disclaimer: {
      text: "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.",
    },
  };
  return renderPdfHtml(mockReport);
}
