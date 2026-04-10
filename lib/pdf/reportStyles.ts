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
  .report-header-brand {
    margin: 0 0 12pt;
    page-break-after: avoid;
  }
  .report-header-brand > svg {
    display: block;
    width: 120pt;
    max-width: 135pt;
    height: auto;
  }
  .report-header-main h1 {
    margin: 4pt 0 6pt;
    font-size: 17pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #111;
    line-height: 1.2;
  }
  .report-doc-label {
    margin: 0 0 2pt;
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
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

  .key-facts-grid {
    display: table;
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    color: #333;
    page-break-inside: avoid;
  }
  .key-fact-row {
    display: table-row;
  }
  .key-fact-label {
    display: table-cell;
    width: 40%;
    padding: 4pt 8pt 4pt 0;
    font-weight: 600;
    color: #444;
    vertical-align: top;
    border-bottom: 1pt solid #eee;
  }
  .key-fact-value {
    display: table-cell;
    padding: 4pt 0;
    vertical-align: top;
    border-bottom: 1pt solid #eee;
    line-height: 1.45;
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
    margin-bottom: 16pt;
    page-break-inside: auto;
  }
  .section-priority {
    page-break-inside: avoid;
  }
  .section-kpi-wrap .kpi-panel {
    page-break-inside: avoid;
  }
  .section-context .subsection-title {
    margin: 12pt 0 6pt;
    font-size: 10pt;
    font-weight: 700;
    color: #333;
    page-break-after: avoid;
  }
  .section-context .subsection-title:first-of-type {
    margin-top: 0;
  }

  .section-work {
    page-break-inside: auto;
  }
  .work-block-list {
    margin-top: 4pt;
  }
  .work-list-item {
    margin-bottom: 10pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #eee;
  }
  .work-list-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .work-list-meta {
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #666;
    margin-bottom: 3pt;
  }
  .work-list-text {
    font-size: 10pt;
    line-height: 1.5;
    color: #222;
  }
  .work-list-footer {
    margin-top: 4pt;
  }

  .strategy-blocks {
    margin-top: 6pt;
  }
  .strategy-block {
    margin-bottom: 12pt;
    padding: 10pt 12pt;
    background: #fafbfc;
    border: 1pt solid #e4e4e4;
    border-radius: 4pt;
    page-break-inside: avoid;
  }
  .strategy-block-title {
    margin: 0 0 6pt;
    font-size: 10pt;
    font-weight: 700;
    color: #1a1a1a;
    page-break-after: avoid;
  }
  .strategy-block-body p {
    margin: 0;
    font-size: 10pt;
    line-height: 1.55;
    color: #333;
  }
  .strategy-list {
    margin: 0;
    padding-left: 18pt;
  }
  .strategy-list li {
    margin-bottom: 5pt;
    line-height: 1.45;
  }

  .section-nachtrag {
    page-break-before: always;
    margin-top: 4pt;
    padding: 12pt 14pt 14pt;
    border-left: 4pt solid #2c5282;
    background: linear-gradient(to right, #f0f6fc 0%, #fafbfc 28%);
    border-radius: 0 6pt 6pt 0;
  }
  .section-nachtrag .section-title {
    border-bottom-color: #cbd5e0;
  }

  .section-internal-notes {
    margin-top: 8pt;
    margin-bottom: 4pt;
    padding: 10pt 12pt 12pt;
    border: 1pt solid #e8e8e8;
    border-radius: 4pt;
    background: #f9f9f9;
    page-break-inside: avoid;
  }
  /* Direkt unter Berichtskopf, vor Executive Summary */
  .section-internal-notes-after-header {
    margin-top: 6pt;
    margin-bottom: 12pt;
  }
  .section-internal-notes .section-title-internal-notes {
    margin: 0 0 6pt;
    font-size: 10pt;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.01em;
    color: #5a5a5a;
    padding-bottom: 3pt;
    border-bottom: 1pt solid #e0e0e0;
  }
  .section-internal-notes .section-lead-internal-notes {
    margin: 0 0 8pt;
    font-size: 8.5pt;
    color: #888;
    line-height: 1.4;
  }
  .internal-notes-body {
    font-size: 9.5pt;
    color: #444;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .section-appendix {
    margin-top: 6pt;
    padding-top: 10pt;
    border-top: 1pt dashed #ccc;
  }
  .section-lead {
    margin: 0 0 8pt;
    font-size: 9pt;
    color: #555;
    line-height: 1.45;
  }
  .section-title-sub {
    font-size: 10pt;
    text-transform: none;
    letter-spacing: 0;
    color: #444;
    border-bottom: none;
    padding-bottom: 0;
  }

  .next-steps-list {
    margin: 0;
    padding-left: 18pt;
    counter-reset: step;
  }
  .next-steps-list li {
    margin-bottom: 8pt;
    line-height: 1.5;
    padding-left: 4pt;
  }

  .top-risks-block {
    margin-top: 4pt;
  }
  .top-risk-item {
    margin-bottom: 10pt;
    padding: 8pt 10pt;
    background: #fafafa;
    border: 1pt solid #eaeaea;
    border-radius: 4pt;
    page-break-inside: avoid;
  }
  .top-risk-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6pt 10pt;
    margin-bottom: 4pt;
  }
  .top-risk-title {
    font-weight: 700;
    font-size: 10pt;
    color: #1a1a1a;
    flex: 1 1 60%;
  }
  .top-risk-meta {
    font-size: 8.5pt;
    color: #555;
    background: #eee;
    padding: 2pt 6pt;
    border-radius: 3pt;
  }
  .top-risk-sev {
    font-size: 8.5pt;
    font-weight: 600;
    color: #444;
  }
  .top-risk-detail {
    font-size: 9pt;
    color: #444;
    line-height: 1.45;
    padding-left: 0;
  }
  .top-risk-pruef {
    margin-top: 6pt;
    font-size: 8.5pt;
    color: #1a3a4a;
    line-height: 1.4;
  }
  .top-risk-pruef-list {
    margin: 4pt 0 0 0;
    padding-left: 14pt;
  }
  .top-risk-pruef-list li {
    margin-bottom: 3pt;
  }

  .legal-signals-block {
    margin-top: 4pt;
  }
  .legal-signal-item {
    margin-bottom: 10pt;
    padding: 8pt 10pt;
    background: #fafafa;
    border: 1pt solid #eaeaea;
    border-radius: 4pt;
    border-left: 3pt solid #6b7280;
    page-break-inside: avoid;
  }
  .legal-signal-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6pt 10pt;
    margin-bottom: 4pt;
  }
  .legal-signal-title {
    font-weight: 700;
    font-size: 10pt;
    color: #1a1a1a;
    flex: 1 1 60%;
  }
  .legal-signal-sev {
    font-size: 8.5pt;
    font-weight: 600;
    color: #666;
  }
  .legal-signal-body {
    font-size: 9pt;
    color: #444;
    line-height: 1.45;
  }
  .legal-signal-rec {
    margin-top: 5pt;
    font-size: 9pt;
    font-weight: 600;
    color: #3d5a40;
    line-height: 1.45;
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
