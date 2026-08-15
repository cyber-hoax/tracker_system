import { NextResponse } from "next/server";
import { getLeetCodeSettingsView } from "@/lib/leetcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getLeetCodeSettingsView(), {
    headers: { "Cache-Control": "no-store" },
  });
}
