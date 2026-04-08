"use client";

import React from "react";
import { Pencil, Plus } from "lucide-react";
import { colors, spacing, radius } from "@/lib/ui/theme";
import { KEYFACT_FALLBACK_LABEL } from "@/lib/keyFactsValidation";
import type { ManualProjectFieldKey, ManualValueSource, ProjectInfoRowModel } from "@/lib/manualProjectData";

type Props = {
  rows: ProjectInfoRowModel[];
  notesRow: ProjectInfoRowModel;
  sanitize: (s: string) => string;
  canPersist: boolean;
  onSaveField: (key: ManualProjectFieldKey, value: string) => Promise<void>;
  expertMode?: boolean;
};

/** Kurze Herkunft – nur UI, Logik bleibt in manualProjectData (source). */
function compactSourceLabel(source: ManualValueSource): string {
  switch (source) {
    case "lv":
      return "Aus LV";
    case "manual_fill":
      return "Manuell ergänzt";
    case "manual_override":
      return "Überschrieben";
    case "none":
      return "Nicht erkannt";
    default:
      return "";
  }
}

function isStandardFallbackText(value: string): boolean {
  const t = value.trim();
  return t === KEYFACT_FALLBACK_LABEL || t.includes("nicht zuverlässig erkannt");
}

type DisplayParts = {
  primary: string;
  secondary?: string;
  mutedPrimary: boolean;
};

function getDisplayParts(row: ProjectInfoRowModel, sanitize: (s: string) => string, maxLen: number): DisplayParts {
  const raw = row.finalValue.trim();

  if (row.multiline) {
    if (!raw) {
      return { primary: "Keine interne Notiz hinterlegt", mutedPrimary: true };
    }
    const s = sanitize(raw);
    const primary = s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
    return { primary, mutedPrimary: false };
  }

  if (isStandardFallbackText(raw) || (row.emphasizeFallback && !raw)) {
    return {
      primary: "Nicht hinterlegt",
      secondary: "Nicht aus dem LV erkannt",
      mutedPrimary: true,
    };
  }

  const s = sanitize(row.finalValue);
  const primary = s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
  return { primary, mutedPrimary: row.emphasizeFallback && !isStandardFallbackText(raw) };
}

const ORDER_PROJECT = ["bauvorhaben", "ort", "bauherr_ag", "gewerk", "projektart"] as const;
const ORDER_VERGA = [
  "vertragsgrundlagen",
  "zusatzvertragsbedingungen",
  "fristAngebot",
  "bindefrist",
  "ausfuehrungszeitraum",
] as const;
const ORDER_AUTO = ["lv_strukturgroesse", "vorbemerkungsumfang"] as const;

function pickRowsInOrder(order: readonly string[], rows: ProjectInfoRowModel[]): ProjectInfoRowModel[] {
  const byKey = new Map(rows.map((r) => [r.keyFactKey ?? "", r]));
  const out: ProjectInfoRowModel[] = [];
  for (const k of order) {
    const row = byKey.get(k);
    if (row) out.push(row);
  }
  return out;
}

function buildGroups(rows: ProjectInfoRowModel[]): { title: string; items: ProjectInfoRowModel[] }[] {
  return [
    { title: "Projekt & Beteiligte", items: pickRowsInOrder(ORDER_PROJECT, rows) },
    { title: "Vergabe & Termine", items: pickRowsInOrder(ORDER_VERGA, rows) },
    { title: "Automatische LV-Merkmale", items: pickRowsInOrder(ORDER_AUTO, rows) },
  ].filter((g) => g.items.length > 0);
}

function ProjectFieldRow({
  row,
  sanitize,
  canPersist,
  onSave,
  expertMode,
  embedNotes = false,
}: {
  row: ProjectInfoRowModel;
  sanitize: (s: string) => string;
  canPersist: boolean;
  onSave: (key: ManualProjectFieldKey, value: string) => Promise<void>;
  expertMode: boolean;
  /** Einspaltig ohne linkes Label – für den Notiz-Block unter der Sektionsüberschrift. */
  embedNotes?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(row.finalValue);
  const [saving, setSaving] = React.useState(false);
  const manualKey = row.manualKey;
  const maxLen = expertMode ? 120 : 80;

  React.useEffect(() => {
    if (!open) setDraft(row.finalValue);
  }, [row.finalValue, open]);

  const parts = getDisplayParts(row, sanitize, maxLen);
  const sourceLine = compactSourceLabel(row.source);
  const showSourceLine = (row.editable || row.source !== "none" || row.keyFactKey != null) && !parts.secondary;

  const isAddMode =
    row.editable &&
    !row.multiline &&
    (row.emphasizeFallback || isStandardFallbackText(row.finalValue.trim()) || !row.finalValue.trim());

  const isAddModeNotes = row.multiline && !row.finalValue.trim();

  const rowShell = (children: React.ReactNode) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: embedNotes ? "1fr" : "minmax(132px, 30%) 1fr",
        gap: embedNotes ? 0 : "10px 16px",
        alignItems: "start",
        padding: embedNotes ? 0 : "10px 0",
        borderBottom: embedNotes ? "none" : `1px solid ${colors.border}`,
      }}
    >
      {children}
    </div>
  );

  if (!row.editable || !manualKey) {
    return rowShell(
      <>
        {!embedNotes ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.textMuted,
              lineHeight: 1.45,
              paddingTop: 2,
            }}
          >
            {row.label}
          </div>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: parts.mutedPrimary ? colors.textMuted : colors.text,
              lineHeight: 1.45,
            }}
          >
            {parts.primary}
          </div>
          {showSourceLine ? (
            <div style={{ fontSize: 11, color: colors.textSubtle, marginTop: 4, letterSpacing: "0.01em" }}>
              {sourceLine}
            </div>
          ) : null}
        </div>
      </>,
    );
  }

  return rowShell(
    <>
      {!embedNotes ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.textMuted,
            lineHeight: 1.45,
            paddingTop: 2,
          }}
        >
          {row.label}
        </div>
      ) : null}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: parts.mutedPrimary ? colors.textMuted : colors.text,
            lineHeight: 1.45,
          }}
        >
          {parts.primary}
        </div>
        {parts.secondary ? (
          <div style={{ fontSize: 11, color: colors.textSubtle, marginTop: 3, lineHeight: 1.4 }}>{parts.secondary}</div>
        ) : null}
        {showSourceLine ? (
          <div style={{ fontSize: 11, color: colors.textSubtle, marginTop: parts.secondary ? 2 : 4, letterSpacing: "0.01em" }}>
            {sourceLine}
          </div>
        ) : null}

        {!canPersist ? (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: colors.textSubtle, lineHeight: 1.4 }}>
            Speichern Sie die Analyse, um Änderungen dauerhaft zu übernehmen.
          </p>
        ) : open ? (
          <div
            style={{
              marginTop: 10,
              padding: spacing[2],
              borderRadius: radius.md,
              border: `1px solid ${colors.borderLight}`,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            {row.multiline ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 13,
                  lineHeight: 1.5,
                  padding: "10px 12px",
                  borderRadius: radius.sm,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  fontFamily: "inherit",
                }}
              />
            ) : (
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 13,
                  padding: "9px 12px",
                  borderRadius: radius.sm,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                }}
              />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => void (async () => {
                  setSaving(true);
                  try {
                    await onSave(manualKey, draft);
                    setOpen(false);
                  } finally {
                    setSaving(false);
                  }
                })()}
                style={{
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: radius.sm,
                  background: colors.primary,
                  color: "#0a0e1a",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.75 : 1,
                }}
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft(row.finalValue);
                  setOpen(false);
                }}
                style={{
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.sm,
                  background: "transparent",
                  color: colors.textMuted,
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void (async () => {
                  setSaving(true);
                  try {
                    await onSave(manualKey, "");
                    setOpen(false);
                  } finally {
                    setSaving(false);
                  }
                })()}
                style={{
                  padding: "7px 8px",
                  fontSize: 11,
                  fontWeight: 500,
                  border: "none",
                  background: "transparent",
                  color: colors.textSubtle,
                  cursor: saving ? "not-allowed" : "pointer",
                  marginLeft: "auto",
                }}
              >
                Manuelle Eingabe entfernen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 8,
              padding: 0,
              fontSize: 11,
              fontWeight: isAddMode || isAddModeNotes ? 600 : 500,
              color: isAddMode || isAddModeNotes ? "rgba(255,255,255,0.72)" : colors.textSubtle,
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationStyle: "solid",
              textUnderlineOffset: 3,
              textDecorationColor: "rgba(255,255,255,0.25)",
            }}
          >
            {isAddMode || isAddModeNotes ? (
              <>
                <Plus size={12} strokeWidth={2} aria-hidden />
                Ergänzen
              </>
            ) : (
              <>
                <Pencil size={12} strokeWidth={2} aria-hidden />
                Bearbeiten
              </>
            )}
          </button>
        )}
      </div>
    </>,
  );
}

/**
 * Manuelle Projektdaten: ruhiger Informationsblock (Berichts­niveau), nicht Admin-Formular.
 */
export function ProjectInfoManualLayer({
  rows,
  notesRow,
  sanitize,
  canPersist,
  onSaveField,
  expertMode = false,
}: Props) {
  const groups = React.useMemo(() => buildGroups(rows), [rows]);

  return (
    <div style={{ marginTop: 2 }}>
      {groups.map((group) => (
        <section key={group.title} style={{ marginBottom: spacing[4] }}>
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.textSubtle,
            }}
          >
            {group.title}
          </h3>
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            {group.items.map((row) => (
              <ProjectFieldRow
                key={row.keyFactKey ?? row.manualKey ?? row.label}
                row={row}
                sanitize={sanitize}
                canPersist={canPersist}
                onSave={onSaveField}
                expertMode={expertMode}
              />
            ))}
          </div>
        </section>
      ))}

      <section
        style={{
          marginTop: spacing[4],
          padding: spacing[4],
          borderRadius: radius.lg,
          border: `1px solid ${colors.borderLight}`,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 13,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: "-0.02em",
          }}
        >
          Interne Notizen
        </h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: colors.textMuted, lineHeight: 1.5, maxWidth: 560 }}>
          Nur für Ihr Team sichtbar. Fließt nicht in die LV-Auswertung oder den PDF-Bericht ein.
        </p>
        <ProjectFieldRow
          row={notesRow}
          sanitize={sanitize}
          canPersist={canPersist}
          onSave={onSaveField}
          expertMode={expertMode}
          embedNotes
        />
      </section>
    </div>
  );
}
