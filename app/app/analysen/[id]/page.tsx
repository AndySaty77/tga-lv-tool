import React from "react";
import { DetailContent } from "./DetailContent";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Analyse ${id} – TGA LV Tool`,
    description: "Ergebnisansicht der LV-Analyse.",
  };
}

export default async function AppAnalysenDetailPage({ params }: Props) {
  const { id } = await params;
  return <DetailContent id={id} />;
}
