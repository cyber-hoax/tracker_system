import matter from "gray-matter";

export const PATTERN_HUBS_START = "<!-- pattern-hubs:start -->";
export const PATTERN_HUBS_END = "<!-- pattern-hubs:end -->";

export type ParsedVaultMarkdown = {
  frontmatter: Record<string, unknown>;
  body: string;
};

export type SerializeVaultMarkdownInput = {
  type: "problem" | "pattern";
  frontmatter: Record<string, unknown>;
  body: string;
  patterns: string[];
};

export function parseVaultMarkdown(raw: string): ParsedVaultMarkdown {
  const parsed = matter(raw);
  const data =
    parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : {};
  return {
    frontmatter: data,
    body: stripPatternHubs(parsed.content),
  };
}

export function stripPatternHubs(body: string): string {
  const start = body.indexOf(PATTERN_HUBS_START);
  const end = body.indexOf(PATTERN_HUBS_END);
  if (start === -1 || end === -1 || end < start) {
    return trimOuterNewlines(body);
  }
  const after = body.slice(end + PATTERN_HUBS_END.length);
  const before = body.slice(0, start);
  return trimOuterNewlines(`${before}${after}`);
}

export function serializeVaultMarkdown(
  input: SerializeVaultMarkdownInput,
): string {
  const body = stripPatternHubs(input.body);
  const hubs =
    input.type === "problem" ? renderPatternHubs(input.patterns) : "";
  const rest = [hubs, body].filter((part) => part.length > 0).join("\n\n");
  return matter.stringify(rest, input.frontmatter);
}

export function renderPatternHubs(patterns: string[]): string {
  const names = patterns.map((item) => item.trim()).filter(Boolean);
  if (names.length === 0) {
    return "";
  }
  const links = names
    .map((name) => `[[Patterns/${name}|${name}]]`)
    .join("\n");
  return `${PATTERN_HUBS_START}\n## Pattern hubs\n\n${links}\n${PATTERN_HUBS_END}`;
}

function trimOuterNewlines(text: string): string {
  return text.replace(/^\n+/, "").replace(/\n+$/, "");
}
