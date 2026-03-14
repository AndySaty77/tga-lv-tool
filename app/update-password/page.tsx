import React, { Suspense } from "react";
import { UpdatePasswordClient } from "./UpdatePasswordClient";

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordFallback />}>
      <UpdatePasswordClient />
    </Suspense>
  );
}

function UpdatePasswordFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0e1a",
        color: "rgba(255,255,255,0.62)",
        fontSize: 14,
      }}
    >
      Wird geladen…
    </main>
  );
}
