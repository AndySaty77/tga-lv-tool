// app/analyse/page.tsx – Kundenroute für die LV-Analyse (produktnahe Darstellung, keine Admin-Begriffe)
import { ScorePage } from "../admin/score/page";

export const metadata = {
  title: "Leistungsverzeichnis analysieren",
  description: "Risiken, Unklarheiten und Nachtragspotenziale vor der Angebotsabgabe erkennen – mit Rückfragen und Angebotsklarstellungen.",
};

export default function AnalysePage() {
  return <ScorePage customerRoute />;
}
