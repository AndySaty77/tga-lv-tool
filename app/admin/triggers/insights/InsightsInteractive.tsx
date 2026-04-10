"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAnalysisDisplayTitle } from "@/lib/analysisDisplayTitle";
import type { AnalyseRunLabels, PerAnalysisRow, TriggerFiresInsightsPayload } from "@/lib/triggerFiresInsights";
import { MatchedExcerptCell } from "./MatchedExcerptCell";

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

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const kpiBox: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 28,
  padding: 18,
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  background: "#fafafa",
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

function shortenUuid(id: string): string {
  const s = String(id).trim();
  if (s.length <= 18) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0 %";
  return `${(ratio * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 0 })} %`;
}

function AnalysisTitleCell({ analysisId, labels }: { analysisId: string; labels: AnalyseRunLabels | undefined }) {
  const title = labels ? getAnalysisDisplayTitle(labels.project_name, labels.file_name) : "Kein analyse_run";
  return (
    <div>
      <div style={{ fontWeight: 600, color: "#111" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#888", fontFamily: "ui-monospace, monospace", marginTop: 2 }} title={analysisId}>
        {shortenUuid(analysisId)}
      </div>
      {!labels && (
        <div style={{ fontSize: 11, color: "#c62828", marginTop: 2 }}>Kein Eintrag in analyse_runs (orphan / gelöscht)</div>
      )}
    </div>
  );
}

function TopRiskBadge({ isTop }: { isTop: boolean }) {
  if (!isTop) {
    return <span style={{ color: "#bbb" }}>—</span>;
  }
  return (
    <span
      title="is_top_risk"
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#b71c1c",
        background: "#ffebee",
        padding: "2px 7px",
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      Top
    </span>
  );
}

type GlobalStats = {
  totalRows: number;
  distinctAnalyses: number;
  statsPartial: boolean;
};

type Props = {
  data: TriggerFiresInsightsPayload;
};

export function InsightsInteractive({ data }: Props) {
  const router = useRouter();
  const [flash, setFlash] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PerAnalysisRow & { displayTitle: string } | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [globalStatsErr, setGlobalStatsErr] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const loadGlobalStats = useCallback(async () => {
    setGlobalStatsErr(null);
    try {
      const r = await fetch("/api/admin/trigger-fires", { method: "GET" });
      const j = await r.json();
      if (!r.ok) {
        setGlobalStatsErr(typeof j.error === "string" ? j.error : "Statistik fehlgeschlagen");
        return;
      }
      if (j.stats) setGlobalStats(j.stats as GlobalStats);
    } catch {
      setGlobalStatsErr("Netzwerkfehler beim Laden der Statistik");
    }
  }, []);

  useEffect(() => {
    void loadGlobalStats();
  }, [loadGlobalStats]);

  const runDeleteAnalysis = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setFlash(null);
    try {
      const r = await fetch("/api/admin/trigger-fires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_by_analysis", analysisId: deleteTarget.analysis_id }),
      });
      const j = await r.json();
      if (!r.ok) {
        setFlash({ type: "error", text: typeof j.error === "string" ? j.error : "Löschen fehlgeschlagen" });
        return;
      }
      const n = typeof j.deletedCount === "number" ? j.deletedCount : 0;
      setFlash({ type: "ok", text: n === 0 ? "Keine Zeilen gelöscht (bereits leer)." : `${n} Trigger-Fire-Zeilen gelöscht.` });
      setDeleteTarget(null);
      refresh();
      void loadGlobalStats();
    } catch {
      setFlash({ type: "error", text: "Netzwerkfehler beim Löschen" });
    } finally {
      setBusy(false);
    }
  };

  const runGlobalReset = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const r = await fetch("/api/admin/trigger-fires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_all", confirm: "RESET" }),
      });
      const j = await r.json();
      if (!r.ok) {
        setFlash({ type: "error", text: typeof j.error === "string" ? j.error : "Reset fehlgeschlagen" });
        return;
      }
      const n = typeof j.deletedApprox === "number" ? j.deletedApprox : 0;
      setFlash({ type: "ok", text: `Alle trigger_fires gelöscht (ca. ${n} Zeilen).` });
      setResetOpen(false);
      setResetConfirm("");
      refresh();
      void loadGlobalStats();
    } catch {
      setFlash({ type: "error", text: "Netzwerkfehler beim Reset" });
    } finally {
      setBusy(false);
    }
  };

  const openDeleteRow = (r: PerAnalysisRow) => {
    const labels = data.analyseLabelsById[r.analysis_id];
    const displayTitle = labels ? getAnalysisDisplayTitle(labels.project_name, labels.file_name) : "Kein analyse_run";
    setDeleteTarget({ ...r, displayTitle });
  };

  return (
    <>
      {flash && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 8,
            background: flash.type === "ok" ? "#e8f5e9" : "#ffebee",
            color: flash.type === "ok" ? "#1b5e20" : "#b71c1c",
            border: `1px solid ${flash.type === "ok" ? "#a5d6a7" : "#ffcdd2"}`,
          }}
        >
          {flash.text}
        </div>
      )}

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>KPIs</h2>
        {data.aggregationCapped && (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#856404", background: "#fff8e6", padding: 10, borderRadius: 8 }}>
            Sehr große Datenlage: Aggregationen (außer Gesamtanzahl und letzte Auslösung) beziehen sich nur auf die neuesten Einträge bis
            zur internen Obergrenze. Zwei KPIs sind deshalb ausgeblendet.
          </p>
        )}
        <div style={kpiGrid}>
          <div style={kpiBox}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Trigger-Fires gesamt</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{data.kpis.totalFires.toLocaleString("de-DE")}</div>
          </div>
          <div style={kpiBox}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Analysen mit Fires</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {data.kpis.analysesWithFires == null ? "—" : data.kpis.analysesWithFires.toLocaleString("de-DE")}
            </div>
          </div>
          <div style={kpiBox}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Trigger mit ≥1 Fire</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {data.kpis.distinctTriggersFired == null ? "—" : data.kpis.distinctTriggersFired.toLocaleString("de-DE")}
            </div>
          </div>
          <div style={kpiBox}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Letzte Auslösung</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{fmtDt(data.kpis.lastFireAt)}</div>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Häufigste Trigger</h2>
        {data.aggregationCapped && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
            Rangliste bezieht sich nur auf die neuesten Einträge bis zur internen Obergrenze (nicht die gesamte Historie).
          </p>
        )}
        {data.topTriggers.length === 0 ? (
          <p style={{ marginTop: 12, color: "#555" }}>Keine Zeilen.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={thTd}>trigger_name_snapshot</th>
                  <th style={thTd}>trigger_category_snapshot</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Fires</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Top-Risk</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Top-Risk-Quote</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Analysen</th>
                  <th style={thTd}>letzte Auslösung</th>
                </tr>
              </thead>
              <tbody>
                    {data.topTriggers.map((r) => (
                      <tr key={r.trigger_id}>
                        <td style={thTd}>
                          <Link
                            href={`/admin/triggers/insights/${encodeURIComponent(r.trigger_id)}`}
                            style={{ color: "#1565c0", fontWeight: 600, textDecoration: "underline" }}
                          >
                            {r.trigger_name_snapshot?.trim() || r.trigger_id}
                          </Link>
                        </td>
                    <td style={thTd}>{r.trigger_category_snapshot ?? "—"}</td>
                    <td style={thTd}>{r.fireCount.toLocaleString("de-DE")}</td>
                    <td style={thTd}>{r.topRiskFireCount.toLocaleString("de-DE")}</td>
                    <td style={thTd}>{fmtPct(r.topRiskShare)}</td>
                    <td style={thTd}>{r.analysisCount.toLocaleString("de-DE")}</td>
                    <td style={{ ...thTd, whiteSpace: "nowrap" }}>{fmtDt(r.lastFireAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Letzte Trigger-Fires</h2>
        {data.recentFires.length === 0 ? (
          <p style={{ marginTop: 12, color: "#555" }}>Keine Zeilen.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>created_at</th>
                  <th style={thTd}>Analyse</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Top-Risk</th>
                  <th style={thTd}>trigger_name_snapshot</th>
                  <th style={thTd}>trigger_category_snapshot</th>
                  <th style={thTd}>discipline_context</th>
                  <th style={thTd}>matched_excerpt</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFires.map((r, i) => (
                  <tr key={`${r.analysis_id}-${r.trigger_id}-${r.created_at}-${i}`}>
                    <td style={{ ...thTd, whiteSpace: "nowrap" }}>{fmtDt(r.created_at)}</td>
                    <td style={thTd}>
                      <AnalysisTitleCell analysisId={r.analysis_id} labels={data.analyseLabelsById[r.analysis_id]} />
                    </td>
                    <td style={thTd}>
                      <TopRiskBadge isTop={r.is_top_risk} />
                    </td>
                    <td style={thTd}>{r.trigger_name_snapshot ?? "—"}</td>
                    <td style={thTd}>{r.trigger_category_snapshot ?? "—"}</td>
                    <td style={thTd}>{r.discipline_context ?? "—"}</td>
                    <td style={thTd}>
                      <MatchedExcerptCell text={r.matched_excerpt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Trigger pro Analyse</h2>
        {data.aggregationCapped && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
            Nur Analysen, die in der gleichen Teilmenge wie oben vorkommen; nicht zwingend alle gespeicherten Analysen. Row-Zahlen können bei
            Staffelung von der echten DB abweichen – die Lösch-API arbeitet immer auf der vollen Tabelle.
          </p>
        )}
        {data.perAnalysis.length === 0 ? (
          <p style={{ marginTop: 12, color: "#555" }}>Keine Zeilen.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={thTd}>Analyse</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Rows</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Distinct Trigger</th>
                  <th style={thTd}>letzte Auslösung</th>
                  <th style={{ ...thTd, whiteSpace: "nowrap" }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {data.perAnalysis.map((r) => (
                  <tr key={r.analysis_id}>
                    <td style={thTd}>
                      <AnalysisTitleCell analysisId={r.analysis_id} labels={data.analyseLabelsById[r.analysis_id]} />
                    </td>
                    <td style={thTd}>{r.rowCount.toLocaleString("de-DE")}</td>
                    <td style={thTd}>{r.distinctTriggers.toLocaleString("de-DE")}</td>
                    <td style={{ ...thTd, whiteSpace: "nowrap" }}>{fmtDt(r.lastFireAt)}</td>
                    <td style={thTd}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openDeleteRow(r)}
                        style={{
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #c62828",
                          background: "#fff",
                          color: "#c62828",
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        Fires löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          ...sectionStyle,
          borderColor: "#e57373",
          background: "#fff5f5",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#b71c1c" }}>Gefahrenbereich (intern)</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555", lineHeight: 1.5 }}>
          Vollständiger Reset der Tabelle <strong>trigger_fires</strong> nur. <strong>analyse_runs</strong> und Trigger-Regeln bleiben
          unverändert. Aktion ist nicht rückgängig zu machen.
        </p>
        {globalStatsErr && (
          <p style={{ margin: "10px 0 0", color: "#b71c1c", fontSize: 13 }}>{globalStatsErr}</p>
        )}
        {globalStats && (
          <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#333", fontSize: 13 }}>
            <li>Zeilen gesamt: {globalStats.totalRows.toLocaleString("de-DE")}</li>
            <li>Betroffene Analysen (distinct <code>analysis_id</code>): {globalStats.distinctAnalyses.toLocaleString("de-DE")}</li>
            {globalStats.statsPartial && (
              <li style={{ color: "#856404" }}>
                Distinct-Anzahl kann bei sehr großen Tabellen unvollständig sein (Scan-Deckel).
              </li>
            )}
          </ul>
        )}
        <button
          type="button"
          disabled={busy || !globalStats || globalStats.totalRows === 0}
          onClick={() => {
            setResetOpen(true);
            setResetConfirm("");
          }}
          style={{
            marginTop: 12,
            fontSize: 13,
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #b71c1c",
            background: "#c62828",
            color: "#fff",
            cursor: busy || !globalStats || globalStats.totalRows === 0 ? "not-allowed" : "pointer",
            opacity: !globalStats || globalStats.totalRows === 0 ? 0.5 : 1,
          }}
        >
          Alle trigger_fires löschen…
        </button>
      </section>

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <h3 id="del-title" style={{ margin: 0, fontSize: 18 }}>
              Trigger-Fires löschen?
            </h3>
            <p style={{ margin: "14px 0 0", fontSize: 14, color: "#333", lineHeight: 1.5 }}>
              Es werden <strong>nur</strong> Zeilen in <code>trigger_fires</code> mit dieser Analyse entfernt. Die Analyse in{" "}
              <code>analyse_runs</code> bleibt erhalten.
            </p>
            <dl style={{ margin: "14px 0 0", fontSize: 14 }}>
              <dt style={{ fontWeight: 700, color: "#666" }}>Analysebezeichnung</dt>
              <dd style={{ margin: "4px 0 8px" }}>{deleteTarget.displayTitle}</dd>
              <dt style={{ fontWeight: 700, color: "#666" }}>analysis_id</dt>
              <dd style={{ margin: "4px 0 8px", fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
                {deleteTarget.analysis_id}
              </dd>
              <dt style={{ fontWeight: 700, color: "#666" }}>Betroffene Rows (laut Tabelle)</dt>
              <dd style={{ margin: "4px 0 0" }}>{deleteTarget.rowCount.toLocaleString("de-DE")}</dd>
            </dl>
            <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runDeleteAnalysis()}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #b71c1c",
                  background: "#c62828",
                  color: "#fff",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <h3 id="reset-title" style={{ margin: 0, fontSize: 18, color: "#b71c1c" }}>
              Gesamte trigger_fires leeren?
            </h3>
            <p style={{ margin: "14px 0 0", fontSize: 14, color: "#333", lineHeight: 1.5 }}>
              Alle Einträge in <code>trigger_fires</code> werden gelöscht. Andere Tabellen sind nicht betroffen.
            </p>
            {globalStats && (
              <ul style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 14 }}>
                <li>Zeilen gesamt: {globalStats.totalRows.toLocaleString("de-DE")}</li>
                <li>Analysen (distinct): {globalStats.distinctAnalyses.toLocaleString("de-DE")}</li>
              </ul>
            )}
            <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 600 }}>
              Zur Bestätigung <code>RESET</code> eingeben:
            </label>
            <input
              type="text"
              autoComplete="off"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              style={{
                marginTop: 6,
                width: "100%",
                maxWidth: 280,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: 14,
                fontFamily: "ui-monospace, monospace",
              }}
            />
            <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setResetOpen(false);
                  setResetConfirm("");
                }}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={busy || resetConfirm !== "RESET"}
                onClick={() => void runGlobalReset()}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #b71c1c",
                  background: resetConfirm === "RESET" ? "#b71c1c" : "#e0e0e0",
                  color: resetConfirm === "RESET" ? "#fff" : "#888",
                  cursor: resetConfirm === "RESET" && !busy ? "pointer" : "not-allowed",
                }}
              >
                Alles löschen
              </button>
            </div>
          </div>
        </div>
      )}

         </>
  );
}
