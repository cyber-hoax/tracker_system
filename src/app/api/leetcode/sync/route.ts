import { NextResponse } from "next/server";
import { syncLeetCodeSubmissions } from "@/lib/leetcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await syncLeetCodeSubmissions();
    return NextResponse.json(result, {
      status: result.ok || !result.configured ? 200 : 207,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}
