export type LeetCodeStatusDisplay = string;

export type LeetCodeSubmission = {
  id: number | string;
  title: string;
  titleSlug: string;
  /** Unix seconds or milliseconds. */
  timestamp: number;
  statusDisplay: LeetCodeStatusDisplay;
  lang: string;
  code?: string;
};

export type LeetCodeTopicTag = {
  name: string;
  slug?: string;
};

export type LeetCodeProblemMeta = {
  title: string;
  titleSlug: string;
  difficulty?: string;
  topicTags?: LeetCodeTopicTag[];
  content?: string;
};

export type NoteAutoProperties = {
  Difficulty?: string;
  Status: "Solved" | "Partial";
  Pattern?: string[];
  Description?: string;
  "Last Solved Date": string;
  "Next Revision Date": string;
  "Revision Count": number;
};

export type MappedNotePatch = {
  title: string;
  titleSlug: string;
  properties: NoteAutoProperties;
};

export type LeetCodeSyncReport = {
  ok: boolean;
  configured: boolean;
  ingested: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  lastSyncAt: string | null;
  lastSubmissionAt: string | null;
  message: string;
};

export type LeetCodePollStatus = {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
  lastResult: LeetCodeSyncReport | null;
};

export type LeetCodeSettingsView = {
  username: string;
  hasSession: boolean;
  lastSyncAt: string | null;
  lastSubmissionAt: string | null;
  poll: LeetCodePollStatus;
};
