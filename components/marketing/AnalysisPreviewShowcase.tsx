"use client";

import React, { useState, useEffect, useRef } from "react";
import { marketingTheme as T } from "./MarketingTheme";

const SCREENS = [
  { id: "overview", label: "Ergebnis-Überblick" },
  { id: "summary", label: "Management Summary" },
  { id: "questions", label: "Rückfragen & Klarstellungen" },
] as const;

const AUTO_ROTATE_MS = 4500;
const TRANSITION_MS = 380;

const space = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

const cardBorder = "rgba(255,255,255,0.05)";
const cardBg = "rgba(255,255,255,0.02)";
const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: T.faint,
};

function AppChrome({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: "12px 18px",
        borderBottom: `1px solid ${cardBorder}`,
      }}
    >
      <div style={{ ...labelStyle, fontSize: 11 }}>{title}</div>
    </div>
  );
}

function Screen1Overview() {
  const card = {
    border: `1px solid ${cardBorder}`,
    borderRadius: 12,
    padding: space.md,
    background: cardBg,
  } as const;
  return (
    <div style={{ padding: space.lg, display: "grid", gap: space.lg }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: space.sm }}>
        <div style={card}>
          <div style={labelStyle}>Score</div>
          <div style={{ marginTop: space.sm, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>
            74
          </div>
          <div style={{ marginTop: space.xs, fontSize: 11, color: T.muted }}>Ampel je Kategorie</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>Kritische Trigger</div>
          <div style={{ marginTop: space.sm, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>
            6
          </div>
          <div style={{ marginTop: space.xs, fontSize: 11, color: T.muted }}>mit hoher Relevanz</div>
        </div>
      </div>
      <div style={card}>
        <div style={labelStyle}>Management Summary</div>
        <p style={{ margin: `${space.sm}px 0 0`, fontSize: 13, lineHeight: 1.55, color: T.muted }}>
          Drei Kernaussagen, Sofortmaßnahmen und Top-Risiken – komprimiert für Projektleitung und Kalkulation.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: space.sm }}>
        <div style={card}>
          <div style={labelStyle}>Rückfragen</div>
          <div style={{ marginTop: space.sm, fontSize: 14, fontWeight: 700, color: T.text }}>Gruppiert</div>
          <div style={{ marginTop: space.xs, fontSize: 11, color: T.muted }}>nach Themen & Bauteilen</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>Klarstellungen</div>
          <div style={{ marginTop: space.sm, fontSize: 14, fontWeight: 700, color: T.text }}>Formulierbar</div>
          <div style={{ marginTop: space.xs, fontSize: 11, color: T.muted }}>für Angebotstext</div>
        </div>
      </div>
    </div>
  );
}

const RISK_ITEMS = [
  { label: "Vertrags-/LV-Risiken", status: "red" as const },
  { label: "Mengen & Massenermittlung", status: "yellow" as const },
  { label: "Technische Vollständigkeit", status: "yellow" as const },
  { label: "Schnittstellen & Nebenleistungen", status: "red" as const },
  { label: "Kalkulationsunsicherheit", status: "yellow" as const },
];

function Screen2Summary() {
  return (
    <div style={{ padding: space.lg, display: "grid", gap: space.lg }}>
      <div
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 12,
          padding: space.md,
          background: cardBg,
        }}
      >
        <div style={{ ...labelStyle, marginBottom: space.sm }}>Management Summary</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.65 }}>
          <li style={{ marginBottom: space.xs }}>Mehrere unklare Nebenleistungen mit Nachtragspotenzial</li>
          <li style={{ marginBottom: space.xs }}>Schnittstellen zu MSR und Dokumentation nicht sauber geregelt</li>
          <li>Technische Vollständigkeit in Teilbereichen unklar</li>
        </ul>
      </div>
      <div style={{ display: "grid", gap: space.xs }}>
        {RISK_ITEMS.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                flexShrink: 0,
                background: item.status === "red" ? "rgba(248,113,113,0.75)" : "rgba(234,179,8,0.7)",
              }}
            />
            <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: T.brand,
          padding: "6px 12px",
          borderRadius: 8,
          border: `1px solid ${cardBorder}`,
          background: "rgba(224,124,94,0.08)",
          display: "inline-block",
        }}
      >
        Claim-Potenzial: erhöht
      </div>
    </div>
  );
}

const DEMO_QUESTIONS = [
  "Ist die Inbetriebnahme inkl. Einregulierung vollständig enthalten?",
  "Wer liefert und montiert systemseitige Mess- und Fühlertechnik?",
  "Sind Revisionsunterlagen und Prüfprotokolle geschuldet?",
];

const DEMO_CLARIFICATIONS = [
  "Angebot basiert auf den ausgeschriebenen Mengen und beschriebenen Nebenleistungen.",
  "Nicht eindeutig beschriebene Dokumentations- und Prüfleistungen sind nicht enthalten.",
  "Schnittstellen zu Fremdgewerken sind vor Ausführung gemeinsam abzustimmen.",
];

const BADGES = ["TGA", "VOB", "Schnittstelle", "Dokumentation"] as const;

function Screen3Questions() {
  const itemStyle = {
    padding: "10px 12px",
    marginBottom: space.sm,
    borderRadius: 10,
    border: `1px solid ${cardBorder}`,
    background: cardBg,
    fontSize: 12,
    lineHeight: 1.5,
  } as const;
  return (
    <div
      style={{
        padding: space.lg,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: space.lg,
      }}
    >
      <div>
        <div style={{ ...labelStyle, marginBottom: space.sm }}>Rückfragen</div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {DEMO_QUESTIONS.map((q, i) => (
            <li key={i} style={{ ...itemStyle, color: T.text }}>{q}</li>
          ))}
        </ul>
      </div>
      <div>
        <div style={{ ...labelStyle, marginBottom: space.sm }}>Klarstellungen</div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {DEMO_CLARIFICATIONS.map((c, i) => (
            <li key={i} style={{ ...itemStyle, color: T.muted }}>{c}</li>
          ))}
        </ul>
        <div style={{ marginTop: space.md, display: "flex", flexWrap: "wrap", gap: space.xs }}>
          {BADGES.map((b) => (
            <span
              key={b}
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: T.faint,
                padding: "4px 8px",
                borderRadius: 6,
                border: `1px solid ${cardBorder}`,
                background: cardBg,
              }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalysisPreviewShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isHovered) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % SCREENS.length);
    }, AUTO_ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  const minHeight = 420;
  const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      style={{ width: "100%", maxWidth: 520, marginLeft: "auto", marginRight: "auto", padding: "0 4px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tabs – app-like, subtle */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            style={{
              padding: "8px 14px",
              minHeight: 36,
              borderRadius: 8,
              border: "none",
              background: activeIndex === i ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              color: activeIndex === i ? T.text : T.muted,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: "pointer",
              transition: `background ${TRANSITION_MS}ms ${easeOut}, color ${TRANSITION_MS}ms ${easeOut}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Showcase box – softer border, subtler glow */}
      <div
        style={{
          borderRadius: 20,
          border: `1px solid ${cardBorder}`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
          boxShadow: "0 20px 48px rgba(0,0,0,0.28)",
          overflow: "hidden",
          position: "relative",
          minHeight,
        }}
      >
        {/* Screens – softer fade + smaller slide */}
        {SCREENS.map((s, i) => (
          <div
            key={s.id}
            aria-hidden={activeIndex !== i}
            style={{
              position: "absolute",
              inset: 0,
              opacity: activeIndex === i ? 1 : 0,
              transform: activeIndex === i ? "translateX(0)" : "translateX(6px)",
              pointerEvents: activeIndex === i ? "auto" : "none",
              transition: `opacity ${TRANSITION_MS}ms ${easeOut}, transform ${TRANSITION_MS}ms ${easeOut}`,
              display: "flex",
              flexDirection: "column",
              minHeight,
            }}
          >
            <AppChrome title={s.label} />
            <div style={{ flex: 1, overflow: "auto", paddingBottom: 40 }}>
              {s.id === "overview" && <Screen1Overview />}
              {s.id === "summary" && <Screen2Summary />}
              {s.id === "questions" && <Screen3Questions />}
            </div>
          </div>
        ))}

        {/* Dot indicators – zentriert, einheitlicher Abstand */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            zIndex: 2,
          }}
        >
          {SCREENS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Ansicht ${i + 1}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: activeIndex === i ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)",
                transition: `background ${TRANSITION_MS}ms ${easeOut}`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
