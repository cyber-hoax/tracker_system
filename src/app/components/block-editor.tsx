"use client";

import { CodeBlockField } from "@/app/components/code-block-field";
import { SlashMenu } from "@/app/components/slash-menu";
import { type CodeTheme } from "@/lib/appearance";
import {
  emptyBlock,
  ensureEditableSurface,
  handleEnter,
  insertBlockAfter,
  mergeWithPrevious,
  numberedLabel,
  parseMarkdownToBlocks,
  sequentialIds,
  serializeBlocksToMarkdown,
  slashQuery,
  type EditorBlock,
} from "@/lib/editor/blocks";
import {
  applySlashCommand,
  filterSlashCommands,
  type SlashCommand,
} from "@/lib/editor/slash";
import { Plus } from "@phosphor-icons/react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export function BlockEditor({
  initialMarkdown,
  codeTheme: initialCodeTheme,
  onMarkdownChange,
  onRequestSave,
}: {
  initialMarkdown: string;
  codeTheme: CodeTheme;
  onMarkdownChange: (markdown: string) => void;
  onRequestSave: (markdown: string) => void;
}) {
  const [blocks, setBlocks] = useState(() => {
    const createId = sequentialIds();
    return ensureEditableSurface(
      parseMarkdownToBlocks(initialMarkdown, createId),
      createId,
    );
  });
  const [slashHighlight, setSlashHighlight] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [codeTheme, setCodeTheme] = useState(initialCodeTheme);
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = useRef<{ id: string; cursor: number } | null>(null);

  const slashIndex = blocks.findIndex((block) => slashQuery(block) !== null);
  const slashOpen =
    !slashDismissed && slashIndex >= 0 && slashQuery(blocks[slashIndex]) !== null;
  const query = slashOpen ? (slashQuery(blocks[slashIndex]) ?? "") : "";
  const slashItems = slashOpen ? filterSlashCommands(query) : [];

  function commit(next: EditorBlock[]) {
    const prepared = ensureEditableSurface(next);
    setBlocks(prepared);
    onMarkdownChange(serializeBlocksToMarkdown(prepared));
  }

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    focusNow(pending.id, pending.cursor);
  }, [blocks]);

  function focusNow(id: string, cursor: number) {
    const el = areas.current.get(id);
    if (!el) {
      pendingFocus.current = { id, cursor };
      return;
    }
    el.focus();
    const pos = Math.min(cursor, el.value.length);
    el.setSelectionRange(pos, pos);
  }

  function focusBlock(id: string, cursor: number) {
    pendingFocus.current = { id, cursor };
    focusNow(id, cursor);
  }

  function updateBlock(index: number, patch: Partial<EditorBlock>) {
    const next = blocks.map((block, i) =>
      i === index ? { ...block, ...patch } : block,
    );
    if (slashQuery(next[index] ?? emptyBlock("paragraph")) === null) {
      setSlashDismissed(false);
    }
    commit(next);
  }

  function selectSlash(command: SlashCommand) {
    if (slashIndex < 0) return;
    const result = applySlashCommand(blocks[slashIndex], command);
    const next = [...blocks];
    next[slashIndex] = result.block;
    if (result.extra) next.splice(slashIndex + 1, 0, result.extra);
    else if (command.blockType === "code") {
      next.splice(slashIndex + 1, 0, emptyBlock("paragraph"));
    }
    setSlashDismissed(false);
    const focus = result.extra ?? result.block;
    focusBlock(focus.id, result.block.type === "code" ? 0 : focus.text.length);
    commit(next);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLTextAreaElement>) {
    const block = blocks[index];
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      onRequestSave(serializeBlocksToMarkdown(blocks));
      return;
    }

    if (slashOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashHighlight((value) =>
          slashItems.length === 0 ? 0 : (value + 1) % slashItems.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashHighlight((value) =>
          slashItems.length === 0
            ? 0
            : (value - 1 + slashItems.length) % slashItems.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const command = slashItems[slashHighlight];
        if (command) selectSlash(command);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashDismissed(true);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      if (block.type === "code") {
        const cursor = event.currentTarget.selectionStart ?? block.text.length;
        const atEnd = cursor === block.text.length;
        if (atEnd || event.metaKey || event.ctrlKey) {
          event.preventDefault();
          const existing = blocks[index + 1];
          if (existing?.type === "paragraph") {
            focusBlock(existing.id, existing.text.length);
            return;
          }
          const next = insertBlockAfter(blocks, index, "paragraph");
          focusBlock(next[index + 1].id, 0);
          commit(next);
        }
        return;
      }
      event.preventDefault();
      const cursor = event.currentTarget.selectionStart ?? block.text.length;
      const prevIds = new Set(blocks.map((item) => item.id));
      const next = handleEnter(blocks, index, cursor);
      const created = next.find((item, i) => i > index && !prevIds.has(item.id));
      if (created) {
        focusBlock(created.id, 0);
      } else {
        const keep =
          next.find((item) => item.id === block.id) ??
          next[Math.min(index, next.length - 1)];
        focusBlock(keep.id, 0);
      }
      commit(next);
      return;
    }

    if (event.key === "Backspace") {
      const el = event.currentTarget;
      if (el.selectionStart === 0 && el.selectionEnd === 0) {
        if (block.text === "" && blocks.length > 1) {
          event.preventDefault();
          const next = blocks.filter((_, i) => i !== index);
          const target = next[Math.max(0, index - 1)];
          focusBlock(target.id, target.text.length);
          commit(next);
          return;
        }
        const merged = mergeWithPrevious(blocks, index);
        if (merged) {
          event.preventDefault();
          focusBlock(merged.focusId, merged.cursor);
          commit(merged.blocks);
        }
      }
    }
  }

  function insertAfter(index: number) {
    const next = insertBlockAfter(blocks, index, "paragraph");
    const target = next[index + 1] ?? next[index];
    focusBlock(target.id, 0);
    commit(next);
  }

  return (
    <div
      className="markdown block-editor min-h-0 flex-1 space-y-0.5"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("textarea, select, button, input, a")) return;
        event.preventDefault();
        const last = blocks[blocks.length - 1];
        if (!last) return;
        requestAnimationFrame(() => focusNow(last.id, last.text.length));
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        onRequestSave(serializeBlocksToMarkdown(blocks));
      }}
    >
      {blocks.map((block, index) => (
        <div key={block.id} className="group relative flex items-start gap-1">
          <button
            type="button"
            aria-label="Insert block"
            onClick={() => insertAfter(index)}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-ctp-overlay0 opacity-0 hover:bg-ctp-surface0 hover:text-ctp-text group-hover:opacity-100"
          >
            <Plus size={16} weight="bold" />
          </button>
          <BlockRow
            block={block}
            index={index}
            afterCode={blocks[index - 1]?.type === "code"}
            blocks={blocks}
            onKeyDown={(event) => onKeyDown(index, event)}
            onTextChange={(text) => updateBlock(index, { text })}
            onToggleTodo={() =>
              updateBlock(index, { checked: !block.checked })
            }
            onLanguageChange={(language) => updateBlock(index, { language })}
            onInsertAfter={() => insertAfter(index)}
            codeTheme={codeTheme}
            onCodeThemeChange={setCodeTheme}
            showCodeTheme={
              block.type === "code" &&
              blocks.findIndex((item) => item.type === "code") === index
            }
            textareaRef={(el) => {
              if (el) areas.current.set(block.id, el);
              else areas.current.delete(block.id);
            }}
          />
        </div>
      ))}
      {slashOpen && blocks[slashIndex] ? (
        <SlashMenu
          anchorId={blocks[slashIndex].id}
          query={query}
          highlighted={Math.min(slashHighlight, Math.max(slashItems.length - 1, 0))}
          onHighlight={setSlashHighlight}
          onSelect={selectSlash}
        />
      ) : null}
    </div>
  );
}

function BlockRow({
  block,
  index,
  afterCode,
  blocks,
  onKeyDown,
  onTextChange,
  onToggleTodo,
  onLanguageChange,
  onInsertAfter,
  codeTheme,
  onCodeThemeChange,
  showCodeTheme,
  textareaRef,
}: {
  block: EditorBlock;
  index: number;
  afterCode: boolean;
  blocks: EditorBlock[];
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextChange: (text: string) => void;
  onToggleTodo: () => void;
  onLanguageChange: (language: string) => void;
  onInsertAfter: () => void;
  codeTheme: CodeTheme;
  onCodeThemeChange: (theme: CodeTheme) => void;
  showCodeTheme: boolean;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
}) {
  if (block.type === "divider") {
    return (
      <div
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onInsertAfter();
          }
        }}
        className="block-divider min-w-0 flex-1 py-3"
      >
        <hr className="border-ctp-surface1" />
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <div className="min-w-0 flex-1">
        <CodeBlockField
          id={block.id}
          text={block.text}
          language={block.language ?? ""}
          codeTheme={codeTheme}
          onTextChange={onTextChange}
          onLanguageChange={onLanguageChange}
          onCodeThemeChange={onCodeThemeChange}
          showTheme={showCodeTheme}
          onKeyDown={onKeyDown}
          textareaRef={textareaRef}
        />
      </div>
    );
  }

  const placeholder =
    block.type === "paragraph"
      ? index === 0 && blocks.length === 1
        ? "Type '/' for commands"
        : ""
      : block.type === "heading1"
        ? "Heading 1"
        : block.type === "heading2"
          ? "Heading 2"
          : block.type === "heading3"
            ? "Heading 3"
            : block.type === "quote"
              ? "Quote"
              : "List";

  return (
    <div
      className={`flex min-w-0 flex-1 items-start gap-2 ${blockClass(block.type)} ${
        afterCode ? "pt-4" : ""
      }`}
    >
      {block.type === "todo" ? (
        <input
          type="checkbox"
          checked={Boolean(block.checked)}
          onChange={onToggleTodo}
          className="mt-2"
          aria-label="Toggle to-do"
        />
      ) : null}
      {block.type === "bullet" ? (
        <span className="mt-1.5 w-4 text-center text-ctp-overlay1" aria-hidden>
          •
        </span>
      ) : null}
      {block.type === "numbered" ? (
        <span className="mt-1.5 w-6 text-right font-mono text-sm text-ctp-overlay1">
          {numberedLabel(blocks, index)}.
        </span>
      ) : null}
      <GrowTextarea
        id={block.id}
        value={block.text}
        placeholder={placeholder}
        className="block-input min-w-0 flex-1 caret-ctp-lavender placeholder:text-ctp-overlay1"
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        textareaRef={textareaRef}
      />
    </div>
  );
}

function blockClass(type: EditorBlock["type"]): string {
  switch (type) {
    case "heading1":
      return "block-h1";
    case "heading2":
      return "block-h2";
    case "heading3":
      return "block-h3";
    case "quote":
      return "block-quote";
    case "bullet":
    case "numbered":
    case "todo":
      return "block-list";
    default:
      return "block-paragraph";
  }
}

function GrowTextarea({
  id,
  value,
  placeholder,
  className,
  onChange,
  onKeyDown,
  textareaRef,
}: {
  id: string;
  value: string;
  placeholder: string;
  className: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
  }, [value]);

  return (
    <textarea
      id={id}
      ref={(el) => {
        inner.current = el;
        textareaRef(el);
      }}
      value={value}
      rows={1}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className={className}
    />
  );
}
