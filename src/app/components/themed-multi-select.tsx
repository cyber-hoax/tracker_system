"use client";

import {
  addMultiSelectValue,
  filterMultiSelectOptions,
  removeMultiSelectValue,
} from "@/lib/ui/multi-select";
import { tagAccent, tagChipStyle } from "@/lib/ui/tag-color";
import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export function ThemedMultiSelect({
  values,
  suggestions,
  disabled,
  placeholder = "Add…",
  onChange,
  getHref,
}: {
  values: string[];
  suggestions: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string[]) => void;
  getHref?: (value: string) => string | undefined;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const options = useMemo(
    () => filterMultiSelectOptions(suggestions, values, draft),
    [suggestions, values, draft],
  );

  useEffect(() => {
    setHighlight(0);
  }, [draft, open, options.length]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = rootRef.current;
    if (!panel || !anchor || !open) return;
    const rect = anchor.getBoundingClientRect();
    const menuHeight = panel.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < menuHeight + 8 && rect.top > menuHeight
        ? rect.top - menuHeight - 4
        : rect.bottom + 4;
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${Math.max(8, rect.left)}px`;
    panel.style.width = `${rect.width}px`;
  }, [open, draft, options.length, values.length]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function commit(raw: string) {
    const next = addMultiSelectValue(values, raw);
    if (next !== values) onChange(next);
    setDraft("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) =>
        options.length === 0 ? 0 : (index + 1) % options.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) =>
        options.length === 0
          ? 0
          : (index - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(removeMultiSelectValue(values, values[values.length - 1]));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = options[highlight];
      if (picked) {
        commit(picked);
        return;
      }
      if (draft.trim()) commit(draft);
    }
  }

  const menu =
    open && !disabled && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={panelRef}
            id={listId}
            role="listbox"
            className="fixed z-50 max-h-48 overflow-y-auto rounded-md border border-ctp-surface1 bg-ctp-base shadow-xl"
          >
            {options.length === 0 ? (
              <li>
                {draft.trim() ? (
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      commit(draft);
                    }}
                    className="w-full px-2.5 py-2 text-left text-sm text-ctp-mauve"
                  >
                    Add “{draft.trim()}”
                  </button>
                ) : (
                  <span className="block px-2.5 py-2 text-sm text-ctp-overlay0">
                    No matches
                  </span>
                )}
              </li>
            ) : (
              options.map((item, index) => (
                <li key={item} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      commit(item);
                    }}
                    className={`flex w-full items-center gap-2 truncate px-2.5 py-1.5 text-left text-sm ${
                      index === highlight
                        ? "bg-ctp-surface0 text-ctp-text"
                        : "text-ctp-text"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: `var(--ctp-${tagAccent(item)})`,
                      }}
                    />
                    {item}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`flex min-h-[2.25rem] flex-wrap items-center gap-1 rounded-md border border-ctp-surface1 bg-ctp-mantle px-1.5 py-1 ${
          disabled ? "opacity-60" : ""
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((item) => (
          <span
            key={item}
            className="tag-chip inline-flex max-w-full items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-xs"
            style={tagChipStyle(item)}
          >
            {getHref?.(item) ? (
              <Link
                href={getHref(item)!}
                className="min-w-0 truncate hover:opacity-80"
                onClick={(event) => event.stopPropagation()}
              >
                {item}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{item}</span>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${item}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange(removeMultiSelectValue(values, item));
              }}
              className="flex h-4 w-4 items-center justify-center opacity-60 hover:text-ctp-red hover:opacity-100"
            >
              <X size={12} weight="bold" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={values.length === 0 ? placeholder : ""}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-ctp-text outline-none placeholder:text-ctp-overlay0"
        />
      </div>
      {menu}
    </div>
  );
}
