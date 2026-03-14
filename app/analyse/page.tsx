// app/analyse/page.tsx – Alt-Route: Weiterleitung auf /app/analyse (eingeloggt) bzw. /login (nicht eingeloggt)
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "Weiterleitung – TGA LV Tool",
  description: "Weiterleitung zur Analyse.",
};

/**
 * /analyse wird nicht mehr als eigenständige Seite gepflegt.
 * Eingeloggt → /app/analyse (Analyse in der App-Shell).
 * Nicht eingeloggt → Middleware leitet bereits auf /login?redirectTo=/analyse um;
 * hier läuft die Seite nur an, wenn die Middleware durchgelassen hat (eingeloggt).
 */
export default async function AnalyseRedirectPage() {
  const user = await getUser().catch(() => null);

  if (!user) {
    redirect("/login?redirectTo=/app/analyse");
  }

  redirect("/app/analyse");
}
