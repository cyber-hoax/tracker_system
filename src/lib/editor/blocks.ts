export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "numbered"
  | "todo"
  | "quote"
  | "divider"
  | "code";

export type EditorBlock = {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  language?: string;
};

export type IdFactory = () => string;

export function createBlockId(): string {
  return crypto.randomUUID();
}

export function sequentialIds(): IdFactory {
  let n = 0;
  return () => `block-${++n}`;
}

export function emptyBlock(type: BlockType, createId: IdFactory = createBlockId): EditorBlock {
  if (type === "todo") return { id: createId(), type, text: "", checked: false };
  if (type === "code") return { id: createId(), type, text: "", language: "" };
  return { id: createId(), type, text: "" };
}

function isEmptyParagraph(block: EditorBlock): boolean {
  return block.type === "paragraph" && block.text.trim() === "";
}

/** Keep at most one empty paragraph in a consecutive run. */
export function collapseConsecutiveEmptyParagraphs(
  blocks: EditorBlock[],
): EditorBlock[] {
  const next: EditorBlock[] = [];
  for (const block of blocks) {
    if (isEmptyParagraph(block) && next.length > 0 && isEmptyParagraph(next[next.length - 1])) {
      continue;
    }
    next.push(block);
  }
  return next.length > 0 ? next : [emptyBlock("paragraph")];
}

const LIST_TYPES = new Set<BlockType>(["bullet", "numbered", "todo"]);

function isList(type: BlockType): boolean {
  return LIST_TYPES.has(type);
}

export function parseMarkdownToBlocks(
  markdown: string,
  createId: IdFactory = createBlockId,
): EditorBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: EditorBlock[] = [];
  const paragraph: string[] = [];
  let i = 0;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ id: createId(), type: "paragraph", text: paragraph.join("\n") });
    paragraph.length = 0;
  }

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      const language = fence[1].trim();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({
        id: createId(),
        type: "code",
        text: code.join("\n"),
        language,
      });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const type: BlockType =
        level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3";
      blocks.push({ id: createId(), type, text: heading[2] });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ id: createId(), type: "divider", text: "" });
      i += 1;
      continue;
    }

    const todo = line.match(/^[-*+]\s+\[([ xX])\](?:\s+(.*))?$/);
    if (todo) {
      flushParagraph();
      blocks.push({
        id: createId(),
        type: "todo",
        text: todo[2] ?? "",
        checked: todo[1] !== " ",
      });
      i += 1;
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ id: createId(), type: "bullet", text: bullet[1] });
      i += 1;
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      blocks.push({ id: createId(), type: "numbered", text: numbered[1] });
      i += 1;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      const quoted: string[] = [quote[1]];
      i += 1;
      while (i < lines.length) {
        const next = lines[i].match(/^>\s?(.*)$/);
        if (!next) break;
        quoted.push(next[1]);
        i += 1;
      }
      blocks.push({ id: createId(), type: "quote", text: quoted.join("\n") });
      continue;
    }

    if (line === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  if (blocks.length === 0) {
    blocks.push(emptyBlock("paragraph", createId));
  }
  return blocks;
}

function serializeBlock(block: EditorBlock, numberedIndex: number): string {
  switch (block.type) {
    case "heading1":
      return `# ${block.text}`;
    case "heading2":
      return `## ${block.text}`;
    case "heading3":
      return `### ${block.text}`;
    case "bullet":
      return `- ${block.text}`;
    case "numbered":
      return `${numberedIndex}. ${block.text}`;
    case "todo":
      return `- [${block.checked ? "x" : " "}] ${block.text}`;
    case "quote":
      return block.text.split("\n").map((line) => `> ${line}`.replace(/> $/, ">")).join("\n");
    case "divider":
      return "---";
    case "code": {
      const lang = block.language ?? "";
      return `\`\`\`${lang}\n${block.text}\n\`\`\``;
    }
    default:
      return block.text;
  }
}

export function serializeBlocksToMarkdown(blocks: EditorBlock[]): string {
  const parts: string[] = [];
  let prev: EditorBlock | null = null;
  let numberedIndex = 0;

  for (const block of blocks) {
    if (block.type === "paragraph" && block.text.trim() === "") continue;
    if (block.type === "numbered") numberedIndex += 1;
    else numberedIndex = 0;
    if (prev && !(isList(prev.type) && isList(block.type))) {
      parts.push("");
    }
    parts.push(serializeBlock(block, numberedIndex));
    prev = block;
  }

  return parts.join("\n");
}

export function insertBlockAfter(
  blocks: EditorBlock[],
  index: number,
  type: BlockType,
  createId: IdFactory = createBlockId,
): EditorBlock[] {
  const next = emptyBlock(type, createId);
  return collapseConsecutiveEmptyParagraphs([
    ...blocks.slice(0, index + 1),
    next,
    ...blocks.slice(index + 1),
  ]);
}

export function splitBlockAt(
  blocks: EditorBlock[],
  index: number,
  cursor: number,
  createId: IdFactory = createBlockId,
): EditorBlock[] {
  const block = blocks[index];
  if (!block) return blocks;
  const before = block.text.slice(0, cursor);
  const after = block.text.slice(cursor);
  const nextType: BlockType =
    block.type === "heading1" ||
    block.type === "heading2" ||
    block.type === "heading3" ||
    block.type === "divider"
      ? "paragraph"
      : block.type;
  const first: EditorBlock = { ...block, text: before };
  const second = emptyBlock(nextType, createId);
  second.text = after;
  if (nextType === "todo") second.checked = false;
  if (nextType === "code") second.language = block.language ?? "";
  return [...blocks.slice(0, index), first, second, ...blocks.slice(index + 1)];
}

export function handleEnter(
  blocks: EditorBlock[],
  index: number,
  cursor: number,
  createId: IdFactory = createBlockId,
): EditorBlock[] {
  const block = blocks[index];
  if (!block) return blocks;
  if (block.type === "code") {
    const text = `${block.text.slice(0, cursor)}\n${block.text.slice(cursor)}`;
    return blocks.map((item, i) => (i === index ? { ...item, text } : item));
  }
  if (block.type === "divider") {
    return insertBlockAfter(blocks, index, "paragraph", createId);
  }
  if (isEmptyParagraph(block)) {
    return collapseConsecutiveEmptyParagraphs(blocks);
  }
  const exits =
    (isList(block.type) || block.type === "quote") &&
    block.text === "" &&
    cursor === 0;
  if (exits) {
    return collapseConsecutiveEmptyParagraphs(
      blocks.map((item, i) =>
        i === index ? { ...item, type: "paragraph" as const, checked: undefined } : item,
      ),
    );
  }
  const split = splitBlockAt(blocks, index, cursor, createId);
  const first = split[index];
  // Enter at the start of a block must not leave an empty paragraph above.
  if (first && isEmptyParagraph(first) && split[index + 1]) {
    return collapseConsecutiveEmptyParagraphs([
      ...split.slice(0, index),
      ...split.slice(index + 1),
    ]);
  }
  return collapseConsecutiveEmptyParagraphs(split);
}

export function mergeWithPrevious(
  blocks: EditorBlock[],
  index: number,
): { blocks: EditorBlock[]; focusId: string; cursor: number } | null {
  if (index <= 0) return null;
  const prev = blocks[index - 1];
  const current = blocks[index];
  if (!prev || !current) return null;
  if (prev.type === "divider") {
    return {
      blocks: blocks.filter((_, i) => i !== index - 1),
      focusId: current.id,
      cursor: 0,
    };
  }
  const cursor = prev.text.length;
  const merged: EditorBlock = {
    ...prev,
    text: prev.text + current.text,
  };
  return {
    blocks: [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)],
    focusId: merged.id,
    cursor,
  };
}

export function numberedLabel(blocks: EditorBlock[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    if (blocks[i]?.type === "numbered") n += 1;
    else n = 0;
  }
  return n;
}

export function slashQuery(block: EditorBlock): string | null {
  if (block.type === "code" || block.type === "divider") return null;
  const match = block.text.match(/^\/([^\n]*)$/);
  return match ? match[1] : null;
}
