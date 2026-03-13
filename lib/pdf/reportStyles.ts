/**
 * CSS für den PDF-Report (A4, Management-/Angebotsbericht).
 * Ruhige Typografie, klare Abstände, page-break-Schutz für Blöcke.
 */

export const reportStyles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #2c2c2c;
    background: #fff;
  }

  @page {
    size: A4;
    margin: 18mm;
  }

  .report {
    max-width: 210mm;
    margin: 0 auto;
    padding: 0 0 16pt;
  }

  .report-header {
    margin-bottom: 12pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #333;
    page-break-after: avoid;
  }
  .report-header h1 {
    margin: 0 0 4pt;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #1a1a1a;
  }
  .report-meta {
    font-size: 9pt;
    color: #555;
  }
  .report-meta span + span::before {
    content: " · ";
    color: #999;
  }

  .page-one-block {
    page-break-inside: avoid;
  }

  .kpi-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 8pt;
    margin-bottom: 12pt;
    page-break-inside: avoid;
  }
  .kpi-card {
    flex: 1 1 110pt;
    min-width: 0;
    padding: 8pt 10pt;
    background: #f7f7f7;
    border-radius: 4pt;
    border: 1pt solid #e5e5e5;
    page-break-inside: avoid;
  }
  .kpi-card .kpi-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #666;
    margin-bottom: 2pt;
  }
  .kpi-card .kpi-value {
    font-size: 11pt;
    font-weight: 700;
    color: #1a1a1a;
  }

  .section {
    margin-bottom: 14pt;
    page-break-inside: avoid;
  }
  .section-title {
    margin: 0 0 8pt;
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #333;
    padding-bottom: 4pt;
    border-bottom: 1pt solid #ddd;
    page-break-after: avoid;
  }
  .section-body {
    font-size: 10pt;
    color: #333;
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .section-body p {
    margin: 0 0 6pt;
  }
  .section-body p:last-child {
    margin-bottom: 0;
  }

  .summary-block {
    padding: 10pt 12pt;
    background: #f8f9fa;
    border-left: 3pt solid #555;
    border-radius: 0 4pt 4pt 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    page-break-inside: avoid;
    font-size: 10pt;
    line-height: 1.55;
  }

  .category-block {
    margin-bottom: 10pt;
    padding: 10pt 12pt;
    background: #f9f9f9;
    border: 1pt solid #e8e8e8;
    border-radius: 4pt;
    page-break-inside: avoid;
  }
  .category-block .cat-label {
    font-weight: 700;
    font-size: 10pt;
    margin-bottom: 4pt;
    color: #1a1a1a;
  }
  .category-block .cat-score-line {
    font-size: 9pt;
    color: #444;
    margin-bottom: 2pt;
  }
  .category-block .cat-ampel {
    display: inline-block;
    padding: 2pt 6pt;
    border-radius: 3pt;
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    margin-left: 6pt;
  }
  .category-block .cat-ampel.green {
    background: #e6f4ea;
    color: #0d6832;
  }
  .category-block .cat-ampel.yellow {
    background: #fef7e0;
    color: #8a5a00;
  }
  .category-block .cat-ampel.red {
    background: #fdecea;
    color: #b71c1c;
  }
  .category-block .cat-reason {
    font-size: 9pt;
    color: #555;
    margin-top: 4pt;
  }
  .category-block .cat-drivers {
    margin-top: 6pt;
    padding-left: 18pt;
  }
  .category-block .cat-drivers li {
    margin-bottom: 3pt;
  }

  .claim-list, .numbered-list {
    padding-left: 18pt;
    margin: 0 0 8pt;
  }
  .claim-list li, .numbered-list li {
    margin-bottom: 6pt;
    line-height: 1.45;
  }
  .claim-list ul, .numbered-list ul {
    margin: 2pt 0 0;
    padding-left: 18pt;
  }

  .disclaimer-box {
    margin-top: 14pt;
    padding: 8pt 12pt;
    font-size: 8pt;
    color: #666;
    background: #f5f5f5;
    border-radius: 4pt;
    border: 1pt solid #e8e8e8;
    page-break-inside: avoid;
  }

  .priority-tag {
    display: inline-block;
    font-size: 8pt;
    color: #666;
    margin-left: 6pt;
  }
`.trim();
