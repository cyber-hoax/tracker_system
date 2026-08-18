import { NextResponse } from "next/server";
import { buildBriefing } from "@/lib/coach";
import { deleteSession } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!SESSION_ID.test(id)) {
      return NextResponse.json(
        { error: "Invalid session id", detail: "Invalid session id" },
        { status: 400 },
      );
    }

    const deleted = await deleteSession(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Session not found", detail: "Session not found" },
        { status: 404 },
      );
    }

    const briefing = await buildBriefing();
    return NextResponse.json({ ok: true, briefing });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: detail, detail }, { status: 500 });
  }
}
