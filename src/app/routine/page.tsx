import { connection } from "next/server";
import { RoutineEditor } from "@/app/components/routine-editor";
import { loadRoutineRecord } from "@/lib/routine";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Routine",
};

export default async function RoutinePage() {
  await connection();
  const stored = await loadRoutineRecord();

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
          Weekly plan
        </p>
        <h1 className="text-2xl text-ctp-text">Routine</h1>
        <p className="max-w-2xl text-sm text-ctp-subtext0">
          Build the week here. It is stored in Postgres and drives Today,
          reports, and Apple Calendar. Work and buffer blocks stay off the
          calendar so the day stays readable.
        </p>
      </section>
      <RoutineEditor initialName={stored.name} initialRoutine={stored.payload} />
    </main>
  );
}
