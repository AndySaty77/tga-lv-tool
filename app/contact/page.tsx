import React from "react";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Team / Individuelle Anfrage – TGA LV Tool",
  description: "Kontaktieren Sie uns für Team-Zugang, individuelle Angebote oder eine Demo.",
};

export default function ContactPage() {
  return (
    <MarketingPageShell active="/contact">
      <MarketingSection
        eyebrow="Kontakt"
        title="Team / Individuelle Anfrage"
        lead="Senden Sie uns Ihre Anfrage – wir melden uns zeitnah bei Ihnen. Für Team-Zugang, individuelle Konditionen oder eine Demo."
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
            <ContactForm />
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}
