/**
 * Start the hourly LeetCode poll when the Node server boots.
 * First tick runs shortly after startup (first app run).
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startLeetCodePoll } = await import("./lib/leetcode/poll");
  startLeetCodePoll();
}
