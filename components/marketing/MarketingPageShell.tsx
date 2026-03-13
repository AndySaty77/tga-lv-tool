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
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
      }}
    >
      <MarketingNav active={active} />
      {children}
      <MarketingFooter />
    </main>
  );
}

