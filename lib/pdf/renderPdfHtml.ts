/**
 * Rendert ein AnalysisPdfReport als A4-optimiertes HTML.
 * Keine PDF-Bibliothek – nur HTML-String für spätere Generierung.
 * Alle dynamischen Inhalte werden escaped; leere Abschnitte ausgeblendet oder mit Fallback.
 * Dramaturgie: Entscheidung/Handlung zuerst, Score-Kategorien als Anhang.
 */

import type { AnalysisPdfReport } from "./pdfTypes";
import { getPdfLogoInlineSvg } from "./pdfLogoInline";
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

function parseClaimLevelScore(claimLevel: string): string {
  const s = (claimLevel ?? "").trim();
  if (!s) return "";
  const m = s.match(/(\d{1,3})\s*\/\s*100/);
  if (!m?.[1]) return "";
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return "";
  return `${Math.round(Math.max(0, Math.min(100, n)))}/100`;
}

/**
 * Erzeugt das vollständige HTML-Dokument für den Report.
 */
export function renderPdfHtml(report: AnalysisPdfReport): string {
  const meta = report.meta ?? {};
  const summary = report.summary ?? {};
  const keyFactRows = Array.isArray(report.keyFacts) ? report.keyFacts : [];
  const categoryScores = Array.isArray(report.categoryScores) ? report.categoryScores : [];
  const claimPotential = report.claimPotential;
  const questions = Array.isArray(report.questions) ? report.questions : [];
  const clarifications = Array.isArray(report.clarifications) ? report.clarifications : [];
  const nextSteps = Array.isArray(report.nextSteps) ? report.nextSteps.filter((s) => opt(s)) : [];
  const topRisksDetailed = Array.isArray(report.topRisks) ? report.topRisks : [];
  const legalSignalsPdf = Array.isArray(report.legalSignals) ? report.legalSignals : [];
  const disclaimer = report.disclaimer?.text ?? "";
  const internalTeamNotes = opt(report.internalTeamNotes);

  const docTitle = "LV Scope – Analysebericht";
  const title = escapeHtml(opt(meta.projectName) || opt(meta.sourceFileName) || "Projekt");
  const projectLine = [opt(meta.projectName), opt(meta.sourceFileName)].filter(Boolean).map(escapeHtml);
  const analyzedAt = escapeHtml(opt(meta.analyzedAt));

  const executiveSummary = opt(summary.executiveSummary);
  const totalScore = summary.totalScore != null && Number.isFinite(summary.totalScore) ? summary.totalScore : null;
  const totalRiskLabel = opt(summary.totalRiskLabel);
  const complexityScore = summary.complexityScore != null && Number.isFinite(summary.complexityScore) ? summary.complexityScore : null;
  const claimLevel = opt(summary.claimLevel);
  const questionCount = summary.questionCount ?? questions.length;
  const clarificationCount = summary.clarificationCount ?? clarifications.length;
  const qTotal = summary.questionsTotalDetected;
  const qDedup = summary.questionsAfterDedupe ?? questionCount;
  const qPri = summary.questionsPrioritizedForManagement;
  const cTotal = summary.clarificationsTotalDetected;
  const cDedup = summary.clarificationsAfterDedupe ?? clarificationCount;
  const cPri = summary.clarificationsPrioritizedForManagement;

  const parts: string[] = [];

  parts.push(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(docTitle)}</title><style>${reportStyles}</style></head><body><div class="report">`
  );

  // A. Berichtskopf
  parts.push('<header class="report-header report-header-main">');
  const logoSvg = getPdfLogoInlineSvg();
  if (logoSvg) {
    parts.push(`<div class="report-header-brand" role="img" aria-label="LV Scope">${logoSvg}</div>`);
  }
  parts.push(`<p class="report-doc-label">${escapeHtml(docTitle)}</p>`);
  parts.push(`<h1>${title}</h1>`);
  parts.push('<div class="report-meta">');
  if (projectLine.length > 0) {
    parts.push(`<span>${projectLine.join(" · ")}</span>`);
  }
  if (analyzedAt) {
    parts.push(`<span>Analysedatum: ${analyzedAt}</span>`);
  }
  if (opt(meta.projectType)) parts.push(`<span>Projektart / Gewerk: ${escapeHtml(opt(meta.projectType))}</span>`);
  if (opt(meta.companyName)) parts.push(`<span>Bauherr / Planung: ${escapeHtml(opt(meta.companyName))}</span>`);
  parts.push("</div></header>");

  // Interne Team-Notizen (nur wenn im Report-Modell gesetzt — typisch nach explizitem Export-Flag + vorhandenem Text)
  if (internalTeamNotes) {
    parts.push('<section class="section section-internal-notes section-internal-notes-after-header">');
    parts.push('<h2 class="section-title section-title-internal-notes">Interne Team-Notizen</h2>');
    parts.push(
      '<p class="section-lead section-lead-internal-notes">Nicht Teil der eigentlichen LV-Auswertung.</p>'
    );
    parts.push('<div class="internal-notes-body">' + escapeHtml(internalTeamNotes) + "</div>");
    parts.push("</section>");
  }

  // B. Executive Summary (Management / Entscheidung)
  if (executiveSummary) {
    parts.push('<section class="section section-priority">');
    parts.push('<h2 class="section-title">Executive Summary</h2>');
    parts.push('<p class="section-lead">Kurzfassung für Management, Angebotsbesprechung und Kalkulationsabstimmung.</p>');
    parts.push('<div class="summary-block section-body">' + escapeHtml(executiveSummary) + "</div>");
    parts.push("</section>");
  }

  // C. Empfohlene nächste Schritte
  if (nextSteps.length > 0) {
    parts.push('<section class="section section-priority">');
    parts.push('<h2 class="section-title">Empfohlene nächste Schritte · vor Angebotsabgabe prüfen</h2>');
    parts.push(
      '<p class="section-lead">Kurz-Checkliste für Angebot und Kalkulation – die detaillierten Formulierungen folgen in den Abschnitten „Rückfragen“ und „Angebotsklarstellungen“.</p>'
    );
    parts.push('<ol class="next-steps-list">');
    for (const step of nextSteps) {
      parts.push("<li>" + escapeHtml(opt(step)) + "</li>");
    }
    parts.push("</ol></section>");
  }

  // D. + E. Eckdaten und Kennzahlen (ein Kontextblock)
  const hasKpis =
    totalScore != null ||
    totalRiskLabel ||
    complexityScore != null ||
    claimLevel ||
    questionCount > 0 ||
    clarificationCount > 0 ||
    (qTotal != null && qTotal > 0) ||
    (cTotal != null && cTotal > 0);
  if (keyFactRows.length > 0 || hasKpis) {
    parts.push('<section class="section section-context">');
    parts.push('<h2 class="section-title">Projektkontext und Kennzahlen</h2>');
    if (keyFactRows.length > 0) {
      parts.push('<h3 class="subsection-title">Eckdaten</h3>');
      parts.push('<div class="key-facts-grid">');
      for (const row of keyFactRows) {
        const lab = escapeHtml(opt(row.label));
        const val = escapeHtml(opt(row.value));
        parts.push('<div class="key-fact-row">');
        parts.push(`<span class="key-fact-label">${lab}</span>`);
        parts.push(`<span class="key-fact-value">${val}</span>`);
        parts.push("</div>");
      }
      parts.push("</div>");
    }
    if (hasKpis) {
      parts.push('<h3 class="subsection-title">Kennzahlen im Überblick</h3>');
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
        const claimScore = parseClaimLevelScore(claimLevel);
        const claimValue = /\/\s*100/.test(claimLevel) ? claimLevel : (claimScore ? `${claimLevel} · ${claimScore}` : claimLevel);
        parts.push(
          '<div class="kpi-card"><div class="kpi-label">Nachtragspotenzial</div><div class="kpi-value">' +
            escapeHtml(claimValue) +
            '</div><div class="kpi-sub">Claim- und Nachtragsbewertung</div>' +
            "</div></div>"
        );
      }
      parts.push("</div>");
      parts.push('<div class="kpi-panel kpi-panel-bottom">');
      if (qTotal != null && qTotal > 0 && qDedup != null) {
        parts.push(
          '<div class="kpi-card"><div class="kpi-label">Rückfragen</div><div class="kpi-value">' +
            escapeHtml(`${qTotal} / ${qDedup}`) +
            "</div>" +
            '<div class="kpi-sub">' +
            escapeHtml(
              qPri != null && qPri > 0
                ? `erkannt / verdichtet · Handlungsfokus bis ${qPri}`
                : "erkannt / verdichtet"
            ) +
            "</div>" +
            "</div>"
        );
      } else if (questionCount > 0) {
        parts.push(
          '<div class="kpi-card"><div class="kpi-label">Rückfragen</div><div class="kpi-value">' +
            escapeHtml(String(questionCount)) +
            "</div></div>"
        );
      }
      if (cTotal != null && cTotal > 0 && cDedup != null) {
        parts.push(
          '<div class="kpi-card"><div class="kpi-label">Klarstellungen</div><div class="kpi-value">' +
            escapeHtml(`${cTotal} / ${cDedup}`) +
            "</div>" +
            '<div class="kpi-sub">' +
            escapeHtml(
              cPri != null && cPri > 0
                ? `erkannt / verdichtet · Fokus bis ${cPri}`
                : "erkannt / verdichtet"
            ) +
            "</div>" +
            "</div>"
        );
      } else if (clarificationCount > 0) {
        parts.push(
          '<div class="kpi-card"><div class="kpi-label">Klarstellungen</div><div class="kpi-value">' +
            escapeHtml(String(clarificationCount)) +
            "</div></div>"
        );
      }
      parts.push("</div>");
    }
    parts.push("</section>");
  }

  // E. Top-Risiken (konkret aus Findings)
  if (topRisksDetailed.length > 0) {
    parts.push('<section class="section">');
    parts.push('<h2 class="section-title">Top-Risiken</h2>');
    parts.push(
      '<p class="section-lead">Die wichtigsten Einzelthemen nach Dringlichkeit – mit fachlicher Kurzeinordnung (ohne interne Bewertungsmetriken).</p>'
    );
    parts.push('<div class="top-risks-block">');
    for (const tr of topRisksDetailed) {
      const t = escapeHtml(opt(tr.title));
      const cat = tr.categoryLabel ? escapeHtml(opt(tr.categoryLabel)) : "";
      const sev = tr.severityHint ? escapeHtml(opt(tr.severityHint)) : "";
      const det = tr.detail ? escapeHtml(opt(tr.detail)) : "";
      parts.push('<div class="top-risk-item">');
      parts.push('<div class="top-risk-head">');
      parts.push(`<span class="top-risk-title">${t}</span>`);
      if (cat) parts.push(`<span class="top-risk-meta">${cat}</span>`);
      if (sev) parts.push(`<span class="top-risk-sev">${sev}</span>`);
      parts.push("</div>");
      if (det) parts.push(`<div class="top-risk-detail">${det}</div>`);
      const ph = Array.isArray(tr.pruefHinweise) ? tr.pruefHinweise.filter((x) => opt(x)) : [];
      if (ph.length > 0) {
        parts.push('<div class="top-risk-pruef"><strong>Prüfhinweise</strong><ul class="top-risk-pruef-list">');
        for (const line of ph) {
          parts.push(`<li>${escapeHtml(opt(line))}</li>`);
        }
        parts.push("</ul></div>");
      }
      parts.push("</div>");
    }
    parts.push("</div></section>");
  }

  // F. Vertraglich auffällige Punkte (V1, optional)
  if (legalSignalsPdf.length > 0) {
    parts.push('<section class="section section-context section-legal-signals">');
    parts.push('<h2 class="section-title">Vertraglich auffällige Punkte</h2>');
    parts.push(
      '<p class="section-lead">Kurze Einordnung aus dem Vortext – für Angebotsprüfung und Kalkulation (keine Rechtsbewertung).</p>'
    );
    parts.push('<div class="legal-signals-block">');
    for (const ls of legalSignalsPdf) {
      const t = escapeHtml(opt(ls.title));
      const sum = opt(ls.summary) ? escapeHtml(opt(ls.summary)) : "";
      const sev = opt(ls.severityLabel) ? escapeHtml(opt(ls.severityLabel)) : "";
      const rec = opt(ls.recommendation) ? escapeHtml(opt(ls.recommendation)) : "";
      parts.push('<div class="legal-signal-item">');
      parts.push('<div class="legal-signal-head">');
      parts.push(`<span class="legal-signal-title">${t}</span>`);
      if (sev) parts.push(`<span class="legal-signal-sev">${sev}</span>`);
      parts.push("</div>");
      if (sum) parts.push(`<div class="legal-signal-body">${sum}</div>`);
      if (rec) parts.push(`<div class="legal-signal-rec">${rec}</div>`);
      parts.push("</div>");
    }
    parts.push("</div></section>");
  }

  // G. Rückfragen (vollständiger Arbeitsblock)
  if (questions.length > 0) {
    parts.push('<section class="section section-work section-questions">');
    parts.push('<h2 class="section-title">Rückfragen an Auftraggeber / Planung</h2>');
    parts.push(
      '<p class="section-lead">Formulierungen für Bieterfragen und E-Mail an den AG – nummeriert zur Übernahme in die Angebotsbearbeitung.</p>'
    );
    parts.push('<ol class="numbered-list work-block-list">');
    for (const q of questions) {
      const text = escapeHtml(opt(q.text));
      const title = opt(q.title);
      const cat = opt(q.categoryLabel);
      const priority = q.priority != null ? escapeHtml(String(q.priority)) : "";
      parts.push('<li class="work-list-item">');
      parts.push('<div class="work-list-body">');
      if (cat) parts.push('<div class="work-list-meta">' + escapeHtml(cat) + "</div>");
      parts.push('<div class="work-list-text">');
      if (title) parts.push("<strong>" + escapeHtml(title) + ":</strong> ");
      parts.push(text);
      parts.push("</div>");
      if (priority) {
        parts.push('<div class="work-list-footer"><span class="priority-tag">Dringlichkeit: ' + priority + "</span></div>");
      }
      parts.push("</div></li>");
    }
    parts.push("</ol></section>");
  }

  // H. Angebotsklarstellungen
  if (clarifications.length > 0) {
    parts.push('<section class="section section-work section-clarifications">');
    parts.push('<h2 class="section-title">Angebotsklarstellungen</h2>');
    parts.push(
      '<p class="section-lead">Annahmen und Zuordnungen, die Sie im Anschreiben oder als Anlage zum Angebot ausweisen können (copy-paste-tauglich).</p>'
    );
    parts.push('<ol class="numbered-list work-block-list">');
    for (const c of clarifications) {
      const text = escapeHtml(opt(c.text));
      const title = opt(c.title);
      const cat = opt(c.categoryLabel);
      parts.push('<li class="work-list-item">');
      parts.push('<div class="work-list-body">');
      if (cat) parts.push('<div class="work-list-meta">' + escapeHtml(cat) + "</div>");
      parts.push('<div class="work-list-text">');
      if (title) parts.push("<strong>" + escapeHtml(title) + ":</strong> ");
      parts.push(text);
      parts.push("</div></div></li>");
    }
    parts.push("</ol></section>");
  }

  // I. Nachtragspotenzial / Strategie
  const hideClaimTopRisksList = topRisksDetailed.length > 0;
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
    const showTopRisksInClaim = !hideClaimTopRisksList && topRisks.length > 0;
    const hasClaim =
      cpExec || showTopRisksInClaim || topNeg.length > 0 || actions.length > 0 || finalRec;
    if (hasClaim) {
      parts.push('<section class="section section-work section-strategy section-nachtrag">');
      parts.push('<h2 class="section-title">Nachtragspotenzial und Angebotsstrategie</h2>');
      parts.push(
        '<p class="section-lead">Arbeitsblock für Angebotsleitung und Kalkulation: Einordnung, strategische Empfehlung, operative Maßnahmen und Verhandlung.</p>'
      );
      parts.push('<div class="strategy-blocks">');
      if (cpExec) {
        parts.push('<div class="strategy-block">');
        parts.push('<h3 class="strategy-block-title">Einordnung</h3>');
        parts.push('<div class="strategy-block-body"><p>' + escapeHtml(cpExec) + "</p></div>");
        parts.push("</div>");
      }
      if (finalRec) {
        parts.push('<div class="strategy-block">');
        parts.push('<h3 class="strategy-block-title">Empfehlung und Angebotsstrategie</h3>');
        parts.push('<div class="strategy-block-body"><p>' + escapeHtml(finalRec) + "</p></div>");
        parts.push("</div>");
      }
      if (actions.length > 0) {
        parts.push('<div class="strategy-block">');
        parts.push('<h3 class="strategy-block-title">Sofortmaßnahmen</h3>');
        parts.push('<ul class="claim-list strategy-list">');
        for (const a of actions) parts.push("<li>" + escapeHtml(opt(a)) + "</li>");
        parts.push("</ul></div>");
      }
      if (topNeg.length > 0) {
        parts.push('<div class="strategy-block">');
        parts.push('<h3 class="strategy-block-title">Verhandlungspunkte</h3>');
        parts.push('<ul class="claim-list strategy-list">');
        for (const n of topNeg) parts.push("<li>" + escapeHtml(opt(n)) + "</li>");
        parts.push("</ul></div>");
      }
      if (showTopRisksInClaim) {
        parts.push('<div class="strategy-block">');
        parts.push('<h3 class="strategy-block-title">Zusätzliche Risiko-Stichworte</h3>');
        parts.push('<ul class="claim-list strategy-list">');
        for (const r of topRisks) parts.push("<li>" + escapeHtml(opt(r)) + "</li>");
        parts.push("</ul></div>");
      }
      parts.push("</div></section>");
    }
  }

  // J. Score-Kategorien (Anhang / Detail)
  if (categoryScores.length > 0) {
    parts.push('<section class="section section-appendix">');
    parts.push('<h2 class="section-title">Anhang: Score-Kategorien im Detail</h2>');
    parts.push(
      '<p class="section-lead">Technische Aufschlüsselung nach Bewertungskategorien – ergänzt die inhaltliche Einordnung in den Abschnitten oben.</p>'
    );
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
        parts.push('<ul class="cat-drivers">');
        for (const d of drivers) parts.push("<li>" + escapeHtml(opt(d)) + "</li>");
        parts.push("</ul>");
      }
      parts.push("</div>");
    }
    parts.push("</section>");
  }

  // K. Hinweis / Disclaimer
  const disclaimerText =
    disclaimer && disclaimer.trim()
      ? disclaimer
      : "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.";
  parts.push('<footer class="disclaimer-box">');
  parts.push("<strong>Hinweis</strong><br/>");
  parts.push(escapeHtml(disclaimerText));
  parts.push("</footer>");

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
    keyFacts: [
      { label: "Projektname", value: "Neubau Verwaltung Nord" },
      { label: "Ort / Standort", value: "Musterstadt" },
      { label: "Gewerk", value: "TGA" },
    ],
    summary: {
      executiveSummary:
        "Die Ausschreibung weist ein moderates Risikoprofil auf. Schwerpunkte liegen bei Schnittstellen und Mengen. Es werden Rückfragen und Klarstellungen empfohlen.",
      totalScore: 58,
      totalRiskLabel: "Erhöhtes Risiko",
      complexityScore: 72,
      questionCount: 3,
      clarificationCount: 2,
    },
    nextSteps: [
      "Rückfrage zu Kabelleitungen vor Abgabe klären und schriftlich dokumentieren.",
      "Massenermittlung bei Planungsänderung vertraglich einordnen.",
      "Klarstellung prüfen: Abgrenzung TGA/ELT wie in LV Abschnitt 2.1.",
      "Verhandlung: Pauschalierung Nebenleistungen vorbereiten.",
    ],
    topRisks: [
      {
        title: "Unklare Abgrenzung Kabelleitungen bis Zähler",
        categoryLabel: "Mengen und Schnittstellen",
        severityHint: "Hohes Einzelrisiko",
        detail: "LV lässt Umfang der Leistung offen; Nachtragspotenzial bei Nachverhandlung.",
      },
      {
        title: "VOB-konforme Gewährleistungsfristen",
        categoryLabel: "Normen und Vertragsgrundlagen",
        severityHint: "Mittleres Einzelrisiko",
        detail: "Formulierung weicht von üblicher Mustervorlage ab.",
      },
    ],
    legalSignals: [
      {
        title: "Abhängigkeit von Vorleistungen oder Dritten",
        summary:
          "Die Leistung hängt erkennbar von bauseitigen Vorleistungen oder anderen Gewerken ab. Das erhöht das Risiko für Behinderungen und Terminverschiebungen.",
        severityLabel: "Mittel",
        recommendation: "Empfehlung: Zuständigkeiten und bauseitige Vorleistungen vor Angebotsabgabe klären.",
      },
    ],
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
      {
        text: "Sind Kabelleitungen bis zum Zähler in der Ausschreibung enthalten?",
        priority: "hoch",
        categoryLabel: "Schnittstellen und Nebenleistungen",
      },
      {
        title: "Massenermittlung",
        text: "Gilt die Massenermittlung als verbindlich bei Planungsänderung?",
        categoryLabel: "Mengen und Massenermittlung",
      },
    ],
    clarifications: [
      {
        title: "Abgrenzung",
        text: "Angebotsannahme: Abgrenzung TGA/ELT wie in LV Abschnitt 2.1.",
        categoryLabel: "Vertrags- und LV-Risiken",
      },
      { text: "Nebenleistungen pauschal wie ausgeschrieben." },
    ],
    disclaimer: {
      text: "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.",
    },
    internalTeamNotes:
      "Kurzer interner Hinweis (Mock): Termin mit AG vor KW 12 abstimmen.\nZweite Zeile nur zur Layout-Prüfung.",
  };
  return renderPdfHtml(mockReport);
}
