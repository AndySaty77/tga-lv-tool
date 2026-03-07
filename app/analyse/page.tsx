// app/analyse/page.tsx – Kundenroute für die LV-Analyse (produktnahe Darstellung, keine Admin-Begriffe)
import { ScorePage } from "../admin/score/page";

export const metadata = {
  title: "LV Analyse",
  description: "Risiko- und Bewertungsanalyse für Leistungsverzeichnisse",
};

export default function AnalysePage() {
  return <ScorePage customerRoute />;
}
