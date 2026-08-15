import { NextResponse } from "next/server";
import { buildBriefing } from "@/lib/coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const briefing = await buildBriefing();
    return NextResponse.json(briefing, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}
