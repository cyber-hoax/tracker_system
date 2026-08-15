import {
  emptyBlock,
  type EditorBlock,
  type IdFactory,
  createBlockId,
  type BlockType,
} from "./blocks";

export type SlashCommand = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  blockType: BlockType;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "todo",
    label: "To-do List",
    description: "Track tasks with a checkbox",
    aliases: ["todo", "checkbox", "task", "check", "to-do", "to"],
    blockType: "todo",
  },
  {
    id: "bullet",
    label: "Bullet List",
    description: "Create a simple bulleted list",
    aliases: ["bullet", "ul", "list", "unordered"],
    blockType: "bullet",
  },
  {
    id: "numbered",
    label: "Numbered List",
    description: "Create a list with numbering",
    aliases: ["numbered", "ol", "number", "ordered"],
    blockType: "numbered",
  },
  {
    id: "heading1",
    label: "Heading 1",
    description: "Big section heading",
    aliases: ["heading 1", "h1", "heading1", "title", "head"],
    blockType: "heading1",
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Medium section heading",
    aliases: ["heading 2", "h2", "heading2", "head"],
    blockType: "heading2",
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "Small section heading",
    aliases: ["heading 3", "h3", "heading3", "head"],
    blockType: "heading3",
  },
  {
    id: "quote",
    label: "Quote",
    description: "Capture a quote",
    aliases: ["quote", "blockquote", "callout"],
    blockType: "quote",
  },
  {
    id: "divider",
    label: "Divider",
    description: "Visually divide blocks",
    aliases: ["divider", "hr", "line", "separator"],
    blockType: "divider",
  },
  {
    id: "code",
    label: "Code Block",
    description: "Capture a code snippet",
    aliases: ["code", "codeblock", "fence", "snippet"],
    blockType: "code",
  },
];

function matchesQuery(field: string, needle: string): boolean {
  const normalized = field.toLowerCase();
  if (normalized.startsWith(needle)) return true;
  return normalized.split(/[\s-]+/).some((word) => word.startsWith(needle));
}

export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((command) =>
    [command.label, command.id, ...command.aliases].some((field) =>
      matchesQuery(field, needle),
    ),
  );
}

export function applySlashCommand(
  block: EditorBlock,
  command: SlashCommand,
  createId: IdFactory = createBlockId,
): { block: EditorBlock; extra?: EditorBlock } {
  const text = block.text.replace(/^\/\S*\s*/, "");
  if (command.blockType === "divider") {
    return {
      block: { ...block, type: "divider", text: "" },
      extra: emptyBlock("paragraph", createId),
    };
  }
  if (command.blockType === "code") {
    return {
      block: { ...block, type: "code", text, language: "" },
    };
  }
  if (command.blockType === "todo") {
    return {
      block: { ...block, type: "todo", text, checked: false, language: undefined },
    };
  }
  return {
    block: {
      ...block,
      type: command.blockType,
      text,
      checked: undefined,
      language: undefined,
    },
  };
}
