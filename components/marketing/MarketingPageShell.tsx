import React from "react";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";
import { marketingTheme as T } from "./MarketingTheme";

export function MarketingPageShell({
  active,
  children,
}: {
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 700px at 20% 10%, rgba(96,165,250,0.28), transparent 55%), radial-gradient(900px 600px at 80% 0%, rgba(94,234,212,0.22), transparent 55%), #0b1220",
        color: T.text,
      }}
    >
      <MarketingNav active={active} />
      {children}
      <MarketingFooter />
    </main>
  );
}

