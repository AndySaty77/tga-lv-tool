import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Profil-Bootstrap wird serverseitig im App-Layout durchgeführt." },
    { status: 410 },
  );
}

