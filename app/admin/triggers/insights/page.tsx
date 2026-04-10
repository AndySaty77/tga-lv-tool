import Link from "next/link";
import { loadTriggerFiresInsights } from "@/lib/triggerFiresInsights";
import { InsightsInteractive } from "./InsightsInteractive";

const pageWrap: React.CSSProperties = {
  padding: 28,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  maxWidth: 1200,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 28,
  padding: 18,
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  background: "#fafafa",
};

export default async function TriggerFiresInsightsPage() {
  const data = await loadTriggerFiresInsights();

  return (
    <div style={pageWrap}>
      <nav style={{ marginBottom: 12, fontSize: 14 }}>
        <Link href="/admin" style={{ color: "#1565c0" }}>
          Admin
        </Link>
        <span style={{ color: "#888", margin: "0 8px" }}>/</span>
        <Link href="/admin/triggers" style={{ color: "#1565c0" }}>
          Trigger
        </Link>
        <span style={{ color: "#888", margin: "0 8px" }}>/</span>
        <span style={{ color: "#333" }}>Insights</span>
      </nav>

      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Trigger-Fires (intern)</h1>
        <p style={{ color: "#666", marginTop: 8, marginBottom: 0, lineHeight: 1.5, maxWidth: 720 }}>
          Auswertung der Tabelle <code style={{ fontSize: 13 }}>trigger_fires</code> – Lesen und kontrolliertes Löschen nur dieser
          Zeilen. <code style={{ fontSize: 13 }}>analyse_runs</code> und Trigger-Regeln bleiben unverändert. Anzeigenamen aus{" "}
          <code style={{ fontSize: 13 }}>analyse_runs</code> per <code style={{ fontSize: 13 }}>id = analysis_id</code> (Service Role,
          Batches). Ohne Treffer: verwaiste oder gelöschte Analyse.
        </p>
      </header>

      {!data.ok ? (
        <div style={{ ...sectionStyle, marginTop: 24, borderColor: "#ffcdd2", background: "#fff8f8" }}>
          <strong>Daten konnten nicht geladen werden</strong>
          <p style={{ margin: "8px 0 0", color: "#555" }}>{data.error}</p>
        </div>
      ) : data.kpis.totalFires === 0 ? (
        <div style={{ ...sectionStyle, marginTop: 24 }}>
          <p style={{ margin: 0, color: "#555" }}>
            Es liegen noch keine Trigger-Fires in der Datenbank. Nach gespeicherten Analysen mit DB-Triggern erscheinen hier KPIs und
            Tabellen.
          </p>
        </div>
      ) : (
        <InsightsInteractive data={data} />
      )}
    </div>
  );
}
