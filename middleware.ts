import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth/is-admin";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(req.url);

  // Admin: nur eingeloggt + Admin-Rolle (ADMIN_EMAILS)
  const isAdminRoute = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  if (isAdminRoute) {
    if (!user) {
      const redirectUrl = new URL("/login", req.url);
      redirectUrl.searchParams.set("redirectTo", url.pathname + url.search);
      return NextResponse.redirect(redirectUrl);
    }
    if (!isAdmin(user)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return res;
  }

  // Geschützte Bereiche: /app und /analyse
  const protectedRoots = ["/app", "/analyse"];
  const isProtected = protectedRoots.some((base) => url.pathname === base || url.pathname.startsWith(base + "/"));

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", req.url);
    const targetPath = url.pathname === "/analyse" || url.pathname.startsWith("/analyse/") ? "/app/analyse" : url.pathname + url.search;
    redirectUrl.searchParams.set("redirectTo", targetPath);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/analyse", "/analyse/:path*", "/admin", "/admin/:path*"],
};

