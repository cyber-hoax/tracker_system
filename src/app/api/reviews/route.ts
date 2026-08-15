import { NextResponse } from "next/server";
import { buildBriefing } from "@/lib/coach";
import { saveReview, weekStartIso } from "@/lib/progress";
import { loadConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewBody = {
  week_start?: string;
  dsa?: string;
  lld?: string;
  hld?: string;
  ai?: string;
  personal?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewBody;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body", detail: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const weekStart =
      body.week_start || weekStartIso(new Date(), loadConfig().timezone);
    const review = await saveReview(weekStart, {
      dsa: String(body.dsa || ""),
      lld: String(body.lld || ""),
      hld: String(body.hld || ""),
      ai: String(body.ai || ""),
      personal: String(body.personal || ""),
    });
    const briefing = await buildBriefing();
    return NextResponse.json({ ok: true, review, briefing });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}
