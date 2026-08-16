export type ChatMdNode =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "divider" };

function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSep(line: string): boolean {
  const cells = splitCells(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes("|") && /^\|.*\|?\s*$/.test(trimmed);
}

export function parseChatMarkdown(markdown: string): ChatMdNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: ChatMdNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const language = fence[1].trim();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push({ type: "code", language, text: code.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      nodes.push({ type: "heading", level, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push({ type: "divider" });
      i += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      nodes.push({ type: "quote", text: quote.join("\n") });
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(/^[-*+]\s+(.*)$/);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      nodes.push({ type: "list", ordered: false, items });
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(/^\d+[.)]\s+(.*)$/);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      nodes.push({ type: "list", ordered: true, items });
      continue;
    }

    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSep(lines[i + 1])
    ) {
      const headers = splitCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      nodes.push({ type: "table", headers, rows });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+[.)]\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    if (paragraph.length > 0) {
      nodes.push({ type: "paragraph", text: paragraph.join("\n") });
    }
  }

  return nodes;
}
