import { Fragment } from "react";
import Link from "next/link";
import type { DbTrigger } from "@/lib/analyzeLvText";
import { getAnalysisDisplayTitle } from "@/lib/analysisDisplayTitle";
import {
  buildFireRowPresentation,
  buildWhyTriggerPlainLanguage,
  loadTriggerFireDetail,
  type TriggerFireRowDetail,
} from "@/lib/triggerFireDetail";
import type { AnalyseRunLabels } from "@/lib/triggerFiresInsights";
import { MatchedExcerptCell } from "../MatchedExcerptCell";

const wrap: React.CSSProperties = {
  padding: 28,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  maxWidth: 1100,
};

const section: React.CSSProperties = {
  marginTop: 24,
  padding: 18,
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  background: "#fafafa",
};

const klartextBox: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 10,
  background: "#e8f4fc",
  border: "1px solid #b3d9f2",
  color: "#0d3c61",
  lineHeight: 1.55,
  fontSize: 14,
};

const technikBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 10,
  background: "#f4f4f4",
  border: "1px solid #ddd",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#333",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thTd: React.CSSProperties = {
  borderBottom: "1px solid #e0e0e0",
  padding: "8px 10px",
  textAlign: "left",
  verticalAlign: "top",
};

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0 %";
  return `${(ratio * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 0 })} %`;
}

function shortenUuid(id: string): string {
  const s = String(id).trim();
  if (s.length <= 18) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function AnalysisCell({ analysisId, labels }: { analysisId: string; labels: AnalyseRunLabels | undefined }) {
  const title = labels ? getAnalysisDisplayTitle(labels.project_name, labels.file_name) : "Kein analyse_run";
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "ui-monospace, monospace", marginTop: 2 }} title={analysisId}>
        {shortenUuid(analysisId)}
      </div>
    </div>
  );
}

function TopBadge({ active }: { active: boolean }) {
  if (!active) return <span style={{ color: "#bbb" }}>—</span>;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#b71c1c",
        background: "#ffebee",
        padding: "2px 7px",
        borderRadius: 4,
      }}
    >
      Top
    </span>
  );
}

const einordnungLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#555",
  marginBottom: 4,
};

const techBox: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  background: "#eceff1",
  borderRadius: 8,
  border: "1px solid #cfd8dc",
  fontSize: 11,
  color: "#37474f",
};

function FireEinordnungCell({ row, trigger }: { row: TriggerFireRowDetail; trigger: DbTrigger | null }) {
  const pres = buildFireRowPresentation(row, trigger);
  return (
    <div style={{ maxWidth: 420 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={einordnungLabel}>Erkanntes Signal im LV</div>
        <div style={{ lineHeight: 1.5 }}>{pres.signalImLv}</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={einordnungLabel}>Fachliche Relevanz</div>
        <div style={{ lineHeight: 1.5, color: "#222" }}>{pres.fachlichRelevant}</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={einordnungLabel}>Typischer Prüfbedarf / Unklarheiten</div>
        <div style={{ lineHeight: 1.5, color: "#222" }}>{pres.pruefbedarf}</div>
      </div>
      {pres.thinSnapshot ? (
        <div style={{ fontSize: 11, color: "#856404", marginBottom: 8, lineHeight: 1.45 }}>
          Hinweis: Dünne Snapshot-Daten – fachliche Kurzfassungen bewusst knapp; Details ggf. in der Analyse oder in der Trigger-Pflege nachziehen.
        </div>
      ) : null}
      <div style={techBox}>
        <div style={{ fontWeight: 800, marginBottom: 8, color: "#263238" }}>Technische Nachvollziehbarkeit</div>
        <dl style={{ margin: 0, display: "grid", gap: 6, gridTemplateColumns: "minmax(110px, 38%) 1fr" }}>
          {pres.technical.map((line) => (
            <Fragment key={line.label}>
              <dt style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#546e7a", wordBreak: "break-all" }}>
                {line.label}
              </dt>
              <dd style={{ margin: 0, lineHeight: 1.4, wordBreak: "break-word" }}>{line.value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

type Props = { params: Promise<{ triggerId: string }> };

export async function generateMetadata({ params }: Props) {
  const { triggerId } = await params;
  return {
    title: `Trigger ${triggerId.slice(0, 8)}… – Insights`,
    description: "Interne Trigger-Detailansicht (trigger_fires).",
  };
}

export default async function TriggerFireDetailPage({ params }: Props) {
  const { triggerId: rawId } = await params;
  const data = await loadTriggerFireDetail(rawId);

  if (!data.ok) {
    return (
      <div style={wrap}>
        <nav style={{ marginBottom: 12, fontSize: 14 }}>
          <Link href="/admin" style={{ color: "#1565c0" }}>
            Admin
          </Link>
          <span style={{ color: "#888", margin: "0 8px" }}>/</span>
          <Link href="/admin/triggers/insights" style={{ color: "#1565c0" }}>
            Trigger-Insights
          </Link>
        </nav>
        <div style={{ ...section, borderColor: "#ffcdd2", background: "#fff8f8" }}>
          <strong>Seite nicht verfügbar</strong>
          <p style={{ margin: "8px 0 0", color: "#555" }}>{data.error}</p>
        </div>
      </div>
    );
  }

  const displayName = data.currentTrigger?.name?.trim() || data.latestSnapshotName?.trim() || "Unbenannter Trigger";
  const displayCategory =
    data.currentTrigger?.category?.trim() || data.latestSnapshotCategory?.trim() || "—";
  const plainLines = buildWhyTriggerPlainLanguage(data.currentTrigger);
  const t = data.currentTrigger;

  return (
    <div style={wrap}>
      <nav style={{ marginBottom: 12, fontSize: 14 }}>
        <Link href="/admin" style={{ color: "#1565c0" }}>
          Admin
        </Link>
        <span style={{ color: "#888", margin: "0 8px" }}>/</span>
        <Link href="/admin/triggers" style={{ color: "#1565c0" }}>
          Trigger
        </Link>
        <span style={{ color: "#888", margin: "0 8px" }}>/</span>
        <Link href="/admin/triggers/insights" style={{ color: "#1565c0" }}>
          Insights
        </Link>
        <span style={{ color: "#888", margin: "0 8px" }}>/</span>
        <span style={{ color: "#333" }}>{displayName}</span>
      </nav>

      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{displayName}</h1>
        <p style={{ fontSize: 13, color: "#666", marginTop: 8, lineHeight: 1.5 }}>
          Interne Auswertung aus <code>trigger_fires</code> (Snapshot pro Analyse). Ohne Änderung an Regeln oder Scoring.
        </p>
      </header>

      <section style={section}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Kopfdaten</h2>
        <dl style={{ margin: "14px 0 0", display: "grid", gap: "8px 16px", gridTemplateColumns: "160px 1fr", fontSize: 14 }}>
          <dt style={{ color: "#666", fontWeight: 600 }}>Trigger-ID</dt>
          <dd style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>{data.triggerId}</dd>
          <dt style={{ color: "#666", fontWeight: 600 }}>Kategorie</dt>
          <dd style={{ margin: 0 }}>{displayCategory}</dd>
          <dt style={{ color: "#666", fontWeight: 600 }}>Fires gesamt</dt>
          <dd style={{ margin: 0 }}>{data.stats.totalFires.toLocaleString("de-DE")}</dd>
          <dt style={{ color: "#666", fontWeight: 600 }}>Analysen mit Treffer</dt>
          <dd style={{ margin: 0 }}>
            {data.stats.analysesWithFires.toLocaleString("de-DE")}
            {data.stats.statsPartial && (
              <span style={{ color: "#856404", fontSize: 12, marginLeft: 6 }}>
                (nur aus ausgewerteter Teilmenge; echte Anzahl kann höher sein)
              </span>
            )}
          </dd>
          <dt style={{ color: "#666", fontWeight: 600 }}>Top-Risk</dt>
          <dd style={{ margin: 0 }}>
            {data.stats.topRiskCount.toLocaleString("de-DE")}{" "}
            <span style={{ color: "#666" }}>
              ({fmtPct(data.stats.topRiskShare)}
              {data.stats.statsPartial ? ", bezogen auf ausgewertete Teilmenge" : ""})
            </span>
          </dd>
          <dt style={{ color: "#666", fontWeight: 600 }}>Letzte Auslösung</dt>
          <dd style={{ margin: 0 }}>{fmtDt(data.stats.lastFireAt)}</dd>
        </dl>
      </section>

      <section style={section}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Warum schlägt dieser Trigger an?</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555", lineHeight: 1.55 }}>
          Allgemeine Zielsetzung der Regel – aus Beschreibung, Prüfhinweis und Konfiguration in „triggers“. Unten in der Tabelle ordnet jede
          Zeile einen konkreten Fire fachlich (Signal, Relevanz, Prüfbedarf) und technisch (Snapshot-Felder) ein. Keine neue Bewertungslogik.
        </p>
        <div style={klartextBox}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            In Klartext
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {plainLines.map((line, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div style={technikBox}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#444" }}>Technische Konfiguration (aktueller Stand in „triggers“)</div>
          {t ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "#444" }}>
              <li>
                <strong>Aktiv:</strong> {t.is_active ? "ja" : "nein"}
              </li>
              <li>
                <strong>Typ:</strong> {t.trigger_type ?? "—"}
              </li>
              <li>
                <strong>Gewicht:</strong> {Number.isFinite(Number(t.weight)) ? t.weight : "—"}
              </li>
              <li>
                <strong>Claim-Level:</strong> {t.claim_level ?? "—"}
              </li>
              <li>
                <strong>match_scope:</strong> {t.match_scope?.trim() || "—"}
              </li>
              {t.disciplines?.length ? (
                <li>
                  <strong>Disziplinen (Regel):</strong> {t.disciplines.join(", ")}
                </li>
              ) : null}
              {t.keywords?.length ? (
                <li>
                  <strong>Keywords (Auszug):</strong>{" "}
                  {t.keywords
                    .filter(Boolean)
                    .slice(0, 20)
                    .join(", ")}
                  {t.keywords.length > 20 ? " …" : ""}
                </li>
              ) : (
                <li>
                  <strong>Keywords:</strong> —
                </li>
              )}
              <li>
                <strong>RegEx:</strong>{" "}
                {t.regex?.trim()
                  ? `${t.regex.trim().slice(0, 160)}${t.regex.trim().length > 160 ? "…" : ""} (Vollständigkeit: /admin/triggers)`
                  : "—"}
              </li>
            </ul>
          ) : (
            <p style={{ margin: 0, color: "#666" }}>Kein aktueller Datensatz in „triggers“ – nur historische Snapshots möglich.</p>
          )}
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#666", fontStyle: "italic" }}>
            Hinweis: <code>trigger_fires</code> speichert Snapshots zum Zeitpunkt der Analyse. Name, Kategorie und Trefferdetails können vom
            heutigen Trigger abweichen.
          </p>
        </div>
      </section>

      {data.stats.totalFires === 0 ? (
        <section style={section}>
          <p style={{ margin: 0, color: "#555" }}>
            Keine gespeicherten Fires für diesen Trigger. Sobald Analysen diesen Trigger auslösen und speichern, erscheinen Tabellen hier.
          </p>
        </section>
      ) : (
        <>
          <section style={section}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Letzte Trigger-Fires</h2>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666", lineHeight: 1.5 }}>
              Die {data.recentFires.length} jüngsten Einträge (read-only). Spalte „Einordnung“ trennt bewusst zwischen fachlicher Lesart und
              technischer Nachvollziehbarkeit; der LV-Auszug ist standardmäßig gekürzt und ausklappbar.
            </p>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#eee" }}>
                    <th style={{ ...thTd, whiteSpace: "nowrap" }}>Datum</th>
                    <th style={thTd}>Analyse</th>
                    <th style={{ ...thTd, whiteSpace: "nowrap" }}>Top-Risk</th>
                    <th style={thTd}>Disziplin</th>
                    <th style={thTd}>Scope</th>
                    <th style={{ ...thTd, minWidth: 280 }}>Einordnung (fachlich · technisch)</th>
                    <th style={{ ...thTd, minWidth: 200 }}>LV-Auszug (Trefferkontext)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentFires.map((r, i) => (
                    <tr key={`${r.analysis_id}-${r.created_at}-${i}`}>
                      <td style={{ ...thTd, whiteSpace: "nowrap" }}>{fmtDt(r.created_at)}</td>
                      <td style={thTd}>
                        <AnalysisCell analysisId={r.analysis_id} labels={data.analyseLabelsById[r.analysis_id]} />
                      </td>
                      <td style={thTd}>
                        <TopBadge active={r.is_top_risk} />
                      </td>
                      <td style={thTd}>{r.discipline_context ?? "—"}</td>
                      <td style={{ ...thTd, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{r.source_scope ?? "—"}</td>
                      <td style={thTd}>
                        <FireEinordnungCell row={r} trigger={t} />
                      </td>
                      <td style={thTd}>
                        <MatchedExcerptCell text={r.matched_excerpt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={section}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Verteilung</h2>
            {data.stats.statsPartial && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#856404" }}>
                Hinweis: Es wurden nicht alle Fires dieses Triggers eingerechnet. Die folgenden Tabellen beschreiben nur die ausgewertete
                Teilmenge und können die Gesamtverteilung verzerren.
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Fires pro Analyse</h3>
                {data.firesByAnalysis.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#666" }}>—</p>
                ) : (
                  <table style={{ ...tableStyle, marginTop: 8 }}>
                    <thead>
                      <tr style={{ background: "#eee" }}>
                        <th style={thTd}>Analyse</th>
                        <th style={{ ...thTd, whiteSpace: "nowrap" }}>Fires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.firesByAnalysis.slice(0, 40).map((row) => (
                        <tr key={row.key}>
                          <td style={thTd}>
                            <AnalysisCell analysisId={row.key} labels={data.analyseLabelsById[row.key]} />
                          </td>
                          <td style={thTd}>{row.count.toLocaleString("de-DE")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {data.firesByAnalysis.length > 40 ? (
                  <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                    … erste 40 von {data.firesByAnalysis.length} Einträgen
                  </p>
                ) : null}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Fires pro Disziplin-Kontext</h3>
                <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>
                  Aus Snapshot-Feld <code>discipline_context</code> (kann leer sein).
                </p>
                {data.firesByDiscipline.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#666" }}>—</p>
                ) : (
                  <table style={{ ...tableStyle, marginTop: 8 }}>
                    <thead>
                      <tr style={{ background: "#eee" }}>
                        <th style={thTd}>Kontext</th>
                        <th style={{ ...thTd, whiteSpace: "nowrap" }}>Fires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.firesByDiscipline.map((row) => (
                        <tr key={row.key}>
                          <td style={thTd}>{row.key}</td>
                          <td style={thTd}>{row.count.toLocaleString("de-DE")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <p style={{ marginTop: 28, fontSize: 14 }}>
        <Link href="/admin/triggers/insights" style={{ color: "#1565c0" }}>
          Zurück zu Trigger-Insights
        </Link>
      </p>
    </div>
  );
}
