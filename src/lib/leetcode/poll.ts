import { POLL_INTERVAL_MS, hasLeetCodeSession } from "./config";
import type { LeetCodePollStatus, LeetCodeSyncReport } from "./types";

type PollState = {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  lastTickAt: string | null;
  nextTickAt: string | null;
  lastResult: LeetCodeSyncReport | null;
  inFlight: Promise<void> | null;
};

const globalForPoll = globalThis as unknown as { __leetcodePoll?: PollState };

function state(): PollState {
  if (!globalForPoll.__leetcodePoll) {
    globalForPoll.__leetcodePoll = {
      timer: null,
      running: false,
      lastTickAt: null,
      nextTickAt: null,
      lastResult: null,
      inFlight: null,
    };
  }
  return globalForPoll.__leetcodePoll;
}

export function startLeetCodePoll(): void {
  const poll = state();
  if (poll.timer) return;
  poll.running = true;
  poll.nextTickAt = new Date(Date.now() + POLL_INTERVAL_MS).toISOString();
  poll.timer = setInterval(() => {
    void runTick();
  }, POLL_INTERVAL_MS);
  setTimeout(() => {
    void runTick();
  }, 1500);
}

export function getLeetCodePollStatus(): LeetCodePollStatus {
  const poll = state();
  return {
    enabled: hasLeetCodeSession(),
    running: poll.running,
    intervalMs: POLL_INTERVAL_MS,
    lastTickAt: poll.lastTickAt,
    nextTickAt: poll.nextTickAt,
    lastResult: poll.lastResult,
  };
}

async function runTick(): Promise<void> {
  const poll = state();
  if (poll.inFlight) return;
  poll.lastTickAt = new Date().toISOString();
  poll.nextTickAt = new Date(Date.now() + POLL_INTERVAL_MS).toISOString();
  poll.inFlight = (async () => {
    const { syncLeetCodeSubmissions } = await import("./sync");
    poll.lastResult = await syncLeetCodeSubmissions();
  })().finally(() => {
    poll.inFlight = null;
  });
  await poll.inFlight;
}
