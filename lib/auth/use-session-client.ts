"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Client-safe Session-Check für den Public-Bereich (z. B. MarketingNav).
 * Nutzt den Browser-Supabase-Client, keine next/headers.
 * Gibt null zurück, bis die Session einmal geladen wurde (neutraler Zustand).
 */
export function useSessionClient(): boolean | null {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  return isLoggedIn;
}
