import { NextResponse } from "next/server";
import { syncCalendar } from "@/lib/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await syncCalendar();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}
