/**
 * Boot-time work for the Node server: create/migrate the local database,
 * then start the hourly LeetCode poll when a session cookie is configured.
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { ensureLocalDatabase } = await import("./db/ensure");
  await ensureLocalDatabase();
  const { startLeetCodePoll } = await import("./lib/leetcode/poll");
  startLeetCodePoll();
}
