export const SUBJECTS = [
  "dsa",
  "lld",
  "hld",
  "ai",
  "reading",
  "walk",
  "review",
  "other",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export type RoutineBlock = {
  start: string;
  end: string;
  title: string;
  kind: string;
  subject: string;
  guide?: string;
};

export type RoutineDay = {
  label: string;
  kind: string;
  summary: string;
  blocks: RoutineBlock[];
};

export type RoutinePhase = {
  id?: string;
  name: string;
  start_month: number;
  end_month: number;
  mix: string;
  dsa_target?: string;
  topics?: string[];
  month_index?: number;
};

export type Routine = {
  timezone?: string;
  calendar_name?: string;
  goal?: string;
  non_negotiables?: string[];
  phases?: RoutinePhase[];
  dsa_explain_flow?: string[];
  weekly_hours?: Record<string, string>;
  days: Record<string, RoutineDay>;
};

export type EnrichedBlock = {
  start: string;
  end: string;
  start_iso: string;
  end_iso: string;
  title: string;
  kind: string;
  subject: string;
  guide: string;
  minutes: number;
  remaining_min: number | null;
  elapsed_min: number | null;
  progress_pct: number;
  day?: string;
  date?: string;
};

export type SessionRecord = {
  id: string;
  ts: string;
  subject: string;
  minutes: number;
  notes: string;
  problems_count: number;
  extra: Record<string, unknown>;
};

export type ReviewRecord = {
  id: string;
  week_start: string;
  created_at: string;
  dsa: string;
  lld: string;
  hld: string;
  ai: string;
  personal: string;
};

export type SubjectBucket = {
  minutes: number;
  sessions: number;
  problems: number;
};

export type WeekStats = {
  week_start: string;
  by_subject: Record<string, SubjectBucket>;
  walk_days: number;
  reading_days: number;
  dsa_problems_total: number;
  dsa_problems_week: number;
  study_minutes_week: number;
  review: ReviewRecord | null;
};

export type ScheduleSnapshot = {
  now: string;
  timezone: string;
  day_key: string;
  day_label: string;
  day_kind: string;
  day_summary: string;
  current: EnrichedBlock | null;
  next: EnrichedBlock | null;
  upcoming: EnrichedBlock[];
  today: EnrichedBlock[];
  phase: RoutinePhase;
  non_negotiables: string[];
  dsa_explain_flow: string[];
  weekly_hours: Record<string, string>;
};

export type Briefing = ScheduleSnapshot & {
  headline: string;
  guidance: string[];
  stats: WeekStats;
  restart_note: string;
};
