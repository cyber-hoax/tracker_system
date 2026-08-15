import { NextResponse } from "next/server";
import { buildBriefing } from "@/lib/coach";
import { addSession, recentSessions, statsForWeek } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const moment = new Date();
    const [recent, stats] = await Promise.all([
      recentSessions(30),
      statsForWeek(moment),
    ]);
    return NextResponse.json(
      { recent, stats },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}

type SessionBody = {
  subject?: string;
  minutes?: number;
  notes?: string;
  problems_count?: number;
  extra?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SessionBody;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body", detail: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const session = await addSession({
      subject: String(body.subject || "other"),
      minutes: Number(body.minutes || 0),
      notes: String(body.notes || ""),
      problems_count: Number(body.problems_count || 0),
      extra: body.extra && typeof body.extra === "object" ? body.extra : {},
    });
    const briefing = await buildBriefing();
    return NextResponse.json({ ok: true, session, briefing });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}
