"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutPage() {
  const router = useRouter();

  React.useEffect(() => {
    const run = async () => {
      await supabase.auth.signOut();
      router.replace("/");
    };
    void run();
  }, [router]);

  return <p style={{ padding: 24 }}>Melde ab…</p>;
}

