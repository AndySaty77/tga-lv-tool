import React from "react";
import type { ContactCategory } from "@/lib/contactCategory";
import { isContactCategory } from "@/lib/contactCategory";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Kontakt – TGA LV Tool",
  description:
    "Kontaktieren Sie uns zu Produkt, Demo, Feedback oder allgemeinen Fragen – wir melden uns zeitnah.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; category?: string }>;
}) {
  const sp = await searchParams;
  let initialCategory: ContactCategory | undefined;
  if (sp.topic === "team") {
    initialCategory = "product";
  } else if (sp.category && isContactCategory(sp.category)) {
    initialCategory = sp.category;
  }

  return (
    <MarketingPageShell active="/contact">
      <MarketingSection
        eyebrow="Kontakt"
        title="Wir freuen uns auf Ihre Nachricht"
        lead="Schreiben Sie uns zu Produktfragen, einer Demo, Feedback oder Wünschen – wir antworten persönlich und zeitnah."
      >
        <Container>
          <div
            style={{
              maxWidth: 560,
              margin: "0 auto",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(21,29,46,0.9)",
              padding: 28,
              boxShadow: "0 16px 40px rgba(15,23,42,0.65)",
            }}
          >
            <ContactForm initialCategory={initialCategory} />
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}
