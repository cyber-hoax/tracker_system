import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { buildBriefing } from "@/lib/coach";
import { recentSessions } from "@/lib/progress";

export const metadata = {
  title: "SDE Prep — Today",
};

export default async function Home() {
  await connection();
  const [initialBriefing, initialRecent] = await Promise.all([
    buildBriefing(),
    recentSessions(30),
  ]);

  return <Dashboard initialBriefing={initialBriefing} initialRecent={initialRecent} />;
}
