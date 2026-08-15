"use client";

import { updateAppearanceAction } from "@/app/actions/appearance";
import {
  CODE_THEME_LABELS,
  CODE_THEMES,
  isCodeTheme,
  type CodeTheme,
} from "@/lib/appearance";
import { CODE_LANGUAGES, highlightCode } from "@/lib/editor/highlight";
import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";

export function CodeBlockField({
  id,
  text,
  language,
  codeTheme,
  onTextChange,
  onLanguageChange,
  onCodeThemeChange,
  onKeyDown,
  textareaRef,
}: {
  id: string;
  text: string;
  language: string;
  codeTheme: CodeTheme;
  onTextChange: (value: string) => void;
  onLanguageChange: (language: string) => void;
  onCodeThemeChange: (theme: CodeTheme) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const pre = useRef<HTMLPreElement | null>(null);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 128)}px`;
  }, [text]);

  const html = highlightCode(text, language);

  return (
    <div data-code-block className="overflow-hidden rounded-md border border-ctp-surface0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ctp-surface0 px-2 py-1">
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-ctp-overlay0">
          Language
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="border border-ctp-surface1 bg-ctp-mantle px-1 py-0.5 font-mono text-[11px] normal-case text-ctp-text"
          >
            {CODE_LANGUAGES.map((item) => (
              <option key={item.id || "plain"} value={item.id}>
                {item.label}
              </option>
            ))}
            {language &&
            !CODE_LANGUAGES.some((item) => item.id === language) ? (
              <option value={language}>{language}</option>
            ) : null}
          </select>
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-ctp-overlay0">
          Theme
          <select
            value={codeTheme}
            onChange={(event) => {
              const next = event.target.value;
              if (!isCodeTheme(next)) return;
              document.documentElement.setAttribute("data-code-theme", next);
              onCodeThemeChange(next);
              void updateAppearanceAction({ codeTheme: next });
            }}
            className="border border-ctp-surface1 bg-ctp-mantle px-1 py-0.5 font-mono text-[11px] normal-case text-ctp-text"
          >
            {CODE_THEMES.map((theme) => (
              <option key={theme} value={theme}>
                {CODE_THEME_LABELS[theme]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="relative">
        <pre
          ref={pre}
          aria-hidden
          className="code-block-highlight pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3 font-mono text-sm leading-6"
        >
          <code dangerouslySetInnerHTML={{ __html: html || " " }} />
        </pre>
        <textarea
          id={id}
          ref={(el) => {
            area.current = el;
            textareaRef(el);
          }}
          value={text}
          spellCheck={false}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(event) => {
            if (pre.current) {
              pre.current.scrollTop = event.currentTarget.scrollTop;
              pre.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          className="code-block-input relative z-10 min-h-[8rem] w-full resize-none overflow-hidden bg-transparent p-3 font-mono text-sm leading-6"
          placeholder="// code"
        />
      </div>
    </div>
  );
}
