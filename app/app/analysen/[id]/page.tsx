import React from "react";
import { DetailContent } from "./DetailContent";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { hasFeature } from "@/lib/billing/plans";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Analyse ${id} – LV Scope`,
    description: "Ergebnisansicht der LV-Analyse.",
  };
}

export default async function AppAnalysenDetailPage({ params }: Props) {
  const { id } = await params;
  let canPdfExport = true;
  try {
    const user = await getUser().catch(() => null);
    if (user) {
      const plan = await getUserPlan();
      canPdfExport = hasFeature(plan, "pdfExport");
    }
  } catch {
    canPdfExport = true;
  }
  return <DetailContent id={id} canPdfExport={canPdfExport} />;
}
