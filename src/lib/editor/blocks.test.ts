import { describe, expect, it } from "vitest";
import {
  collapseConsecutiveEmptyParagraphs,
  ensureEditableSurface,
  handleEnter,
  insertBlockAfter,
  parseMarkdownToBlocks,
  serializeBlocksToMarkdown,
  splitBlockAt,
  type EditorBlock,
} from "./blocks";

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

function snapshot(blocks: EditorBlock[]) {
  return blocks.map((block) => {
    const next: Record<string, unknown> = { type: block.type, text: block.text };
    if (block.checked !== undefined) next.checked = block.checked;
    if (block.language !== undefined) next.language = block.language;
    return next;
  });
}

describe("parseMarkdownToBlocks", () => {
  it("parses empty markdown as one paragraph", () => {
    expect(snapshot(parseMarkdownToBlocks("", ids()))).toEqual([
      { type: "paragraph", text: "" },
    ]);
  });

  it("parses headings, lists, quote, divider, todo, and fenced code", () => {
    const md = [
      "# Title",
      "",
      "## Section",
      "",
      "### Sub",
      "",
      "A paragraph.",
      "",
      "- [ ] todo",
      "- [x] done",
      "- bullet",
      "1. first",
      "2. second",
      "",
      "> quoted",
      "> still",
      "",
      "---",
      "",
      "```ts",
      "const x = 1;",
      "```",
    ].join("\n");

    expect(snapshot(parseMarkdownToBlocks(md, ids()))).toEqual([
      { type: "heading1", text: "Title" },
      { type: "heading2", text: "Section" },
      { type: "heading3", text: "Sub" },
      { type: "paragraph", text: "A paragraph." },
      { type: "todo", text: "todo", checked: false },
      { type: "todo", text: "done", checked: true },
      { type: "bullet", text: "bullet" },
      { type: "numbered", text: "first" },
      { type: "numbered", text: "second" },
      { type: "quote", text: "quoted\nstill" },
      { type: "divider", text: "" },
      { type: "code", text: "const x = 1;", language: "ts" },
    ]);
  });
});

describe("serializeBlocksToMarkdown", () => {
  it("writes slash-insert prefixes and fences", () => {
    const blocks = parseMarkdownToBlocks(
      [
        "# H",
        "- [ ] task",
        "- item",
        "1. one",
        "> note",
        "---",
        "```js",
        "hi",
        "```",
      ].join("\n"),
      ids(),
    );
    expect(serializeBlocksToMarkdown(blocks)).toBe(
      [
        "# H",
        "",
        "- [ ] task",
        "- item",
        "1. one",
        "",
        "> note",
        "",
        "---",
        "",
        "```js",
        "hi",
        "```",
      ].join("\n"),
    );
  });

  it("round-trips mixed markdown", () => {
    const md = [
      "Hello",
      "",
      "## Hub",
      "",
      "- [x] shipped",
      "- keep",
      "",
      "```c++",
      "int mid = 0;",
      "```",
    ].join("\n");
    const once = serializeBlocksToMarkdown(parseMarkdownToBlocks(md, ids()));
    const twice = serializeBlocksToMarkdown(parseMarkdownToBlocks(once, ids()));
    expect(once).toBe(md);
    expect(twice).toBe(md);
  });

  it("serializes an empty note as empty string", () => {
    expect(
      serializeBlocksToMarkdown([{ id: "a", type: "paragraph", text: "" }]),
    ).toBe("");
  });
});

describe("block insert and enter", () => {
  it("inserts a paragraph after the given block", () => {
    const blocks = parseMarkdownToBlocks("Hello", ids());
    const next = insertBlockAfter(blocks, 0, "paragraph", ids());
    expect(snapshot(next)).toEqual([
      { type: "paragraph", text: "Hello" },
      { type: "paragraph", text: "" },
    ]);
  });

  it("splits a paragraph at the cursor into two blocks", () => {
    const blocks = parseMarkdownToBlocks("Hello world", ids());
    const next = splitBlockAt(blocks, 0, 6, ids());
    expect(snapshot(next)).toEqual([
      { type: "paragraph", text: "Hello " },
      { type: "paragraph", text: "world" },
    ]);
  });

  it("creates a new list item on enter in a non-empty bullet", () => {
    const blocks = parseMarkdownToBlocks("- item", ids());
    const next = handleEnter(blocks, 0, 4, ids());
    expect(snapshot(next)).toEqual([
      { type: "bullet", text: "item" },
      { type: "bullet", text: "" },
    ]);
  });

  it("exits an empty list item to a paragraph", () => {
    const blocks: EditorBlock[] = [
      { id: "a", type: "bullet", text: "keep" },
      { id: "b", type: "bullet", text: "" },
    ];
    const next = handleEnter(blocks, 1, 0, ids());
    expect(snapshot(next)).toEqual([
      { type: "bullet", text: "keep" },
      { type: "paragraph", text: "" },
    ]);
  });

  it("creates a new line when Enter is pressed on an empty paragraph", () => {
    const blocks: EditorBlock[] = [{ id: "a", type: "paragraph", text: "" }];
    const next = handleEnter(blocks, 0, 0, ids());
    expect(snapshot(next)).toEqual([
      { type: "paragraph", text: "" },
      { type: "paragraph", text: "" },
    ]);
  });

  it("keeps a new empty paragraph after Enter at the end of a paragraph", () => {
    const blocks = parseMarkdownToBlocks("Hello", ids());
    const afterFirst = handleEnter(blocks, 0, 5, ids());
    expect(snapshot(afterFirst)).toEqual([
      { type: "paragraph", text: "Hello" },
      { type: "paragraph", text: "" },
    ]);
    const afterSecond = handleEnter(afterFirst, 1, 0, ids());
    expect(snapshot(afterSecond)).toEqual([
      { type: "paragraph", text: "Hello" },
      { type: "paragraph", text: "" },
      { type: "paragraph", text: "" },
    ]);
  });

  it("does not leave an empty placeholder above when Enter is pressed at the start of a block", () => {
    const blocks = parseMarkdownToBlocks("Hello", ids());
    const next = handleEnter(blocks, 0, 0, ids());
    expect(snapshot(next)).toEqual([{ type: "paragraph", text: "Hello" }]);
  });

  it("reuses one id factory so trailing surface blocks stay deterministic", () => {
    const createId = ids();
    const blocks = ensureEditableSurface(
      parseMarkdownToBlocks("```cpp\nint x;\n```", createId),
      createId,
    );
    expect(blocks.map((block) => block.id)).toEqual(["id-1", "id-2"]);
  });

  it("adds a blank paragraph after a trailing code block", () => {
    const blocks = parseMarkdownToBlocks("```cpp\nint x;\n```", ids());
    expect(snapshot(ensureEditableSurface(blocks, ids()))).toEqual([
      { type: "code", text: "int x;", language: "cpp" },
      { type: "paragraph", text: "" },
    ]);
  });

  it("inserts a writable paragraph after each code block", () => {
    const blocks = parseMarkdownToBlocks(
      "```cpp\nint x;\n```\n\n# Title\n\n```ts\nconst y = 1;\n```",
      ids(),
    );
    expect(snapshot(ensureEditableSurface(blocks, ids()))).toEqual([
      { type: "code", text: "int x;", language: "cpp" },
      { type: "paragraph", text: "" },
      { type: "heading1", text: "Title" },
      { type: "code", text: "const y = 1;", language: "ts" },
      { type: "paragraph", text: "" },
    ]);
  });

  it("collapses consecutive empty paragraphs to one", () => {
    const collapsed = collapseConsecutiveEmptyParagraphs([
      { id: "a", type: "paragraph", text: "Hello" },
      { id: "b", type: "paragraph", text: "" },
      { id: "c", type: "paragraph", text: "" },
      { id: "d", type: "paragraph", text: "" },
      { id: "e", type: "paragraph", text: "World" },
      { id: "f", type: "paragraph", text: "" },
      { id: "g", type: "paragraph", text: "" },
    ]);
    expect(snapshot(collapsed)).toEqual([
      { type: "paragraph", text: "Hello" },
      { type: "paragraph", text: "" },
      { type: "paragraph", text: "World" },
      { type: "paragraph", text: "" },
    ]);
  });
});
