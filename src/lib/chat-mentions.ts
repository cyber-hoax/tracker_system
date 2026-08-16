export type MentionTrigger = "@" | "/";

export type MentionDraft = {
  trigger: MentionTrigger;
  query: string;
  start: number;
  end: number;
};

export type ChatMentionRef = {
  kind: "file" | "folder";
  id: string;
  label: string;
};

export type ChatMentionHit = ChatMentionRef & {
  hint: string;
};

export function mentionQueryAt(text: string, cursor: number): MentionDraft | null {
  const left = text.slice(0, Math.max(0, cursor));
  const match = left.match(/(^|[\s\n])([@/])([^\s]*)$/);
  if (!match || match.index === undefined) return null;
  const trigger = match[2] as MentionTrigger;
  const query = match[3] ?? "";
  const start = match.index + match[1].length;
  if (trigger === "/" && /https?:$/i.test(left.slice(0, start))) return null;
  return { trigger, query, start, end: cursor };
}

export function insertMention(
  text: string,
  draft: MentionDraft,
  label: string,
): { text: string; cursor: number } {
  const token = `${draft.trigger}${label} `;
  const next = `${text.slice(0, draft.start)}${token}${text.slice(draft.end)}`;
  return { text: next, cursor: draft.start + token.length };
}

export function mentionsStillInText(
  text: string,
  refs: ChatMentionRef[],
): ChatMentionRef[] {
  return refs.filter((ref) => {
    const token = ref.kind === "file" ? `@${ref.label}` : `/${ref.label}`;
    return text.includes(token);
  });
}
