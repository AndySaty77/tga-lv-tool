"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { appTheme as T } from "@/components/app/appTheme";

const CONFIRM_WORD = "LÖSCHEN";

export function DeleteAccountBlock() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setDialogOpen(true);
    setConfirmInput("");
    setError(null);
  };

  const handleClose = () => {
    if (loading) return;
    setDialogOpen(false);
    setConfirmInput("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmInput.trim() !== CONFIRM_WORD || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Löschung fehlgeschlagen. Bitte erneut versuchen.");
        setLoading(false);
        return;
      }
      router.replace("/app/logout");
      return;
    } catch {
      setError("Löschung fehlgeschlagen. Bitte erneut versuchen.");
      setLoading(false);
    }
  };

  return (
    <>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
        Dein Konto und alle zugehörigen Daten (Profil, Analysen) können unwiderruflich gelöscht werden.
      </p>
      <button
        type="button"
        onClick={handleOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: T.danger,
          padding: "6px 10px",
          borderRadius: T.radiusSm,
          border: `1px solid rgba(248,113,113,0.4)`,
          background: "rgba(248,113,113,0.1)",
          cursor: "pointer",
        }}
      >
        Konto löschen
      </button>

      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            padding: T.space.lg,
          }}
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              padding: T.space.lg,
              maxWidth: 400,
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-account-dialog-title"
              style={{ margin: "0 0 " + T.space.md + "px", fontSize: 16, fontWeight: 700, color: T.text }}
            >
              Konto unwiderruflich löschen
            </h2>
            <p style={{ margin: "0 0 " + T.space.md + "px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              Alle deine Analysen, dein Profil und dein Zugang werden dauerhaft gelöscht. Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <p style={{ margin: "0 0 " + T.space.sm + "px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              Zum Bestätigen bitte <strong style={{ color: T.text }}>{CONFIRM_WORD}</strong> eingeben:
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                disabled={loading}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  fontSize: 14,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusSm,
                  background: T.surface,
                  color: T.text,
                  marginBottom: T.space.md,
                }}
              />
              {error && (
                <p style={{ margin: "0 0 " + T.space.md + "px", fontSize: 13, color: T.danger }}>
                  {error}
                </p>
              )}
              <div style={{ display: "flex", gap: T.space.sm, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.muted,
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radiusSm,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={confirmInput.trim() !== CONFIRM_WORD || loading}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                    background: confirmInput.trim() !== CONFIRM_WORD || loading ? T.muted : T.danger,
                    border: "none",
                    borderRadius: T.radiusSm,
                    cursor: confirmInput.trim() !== CONFIRM_WORD || loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Wird gelöscht…" : "Konto endgültig löschen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
