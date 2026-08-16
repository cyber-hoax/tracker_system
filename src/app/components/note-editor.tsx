"use client";

import {
  removeNotePropertyAction,
  setNotePropertyAction,
  updateNoteAction,
} from "@/app/actions/zettel";
import { ThemedMultiSelect } from "@/app/components/themed-multi-select";
import { NoteRightSidebar } from "@/components/note-right-sidebar";
import { type CodeTheme } from "@/lib/appearance";
import { PATTERN_PROPERTY_KEY } from "@/lib/zettel/constants";
import { noteHref } from "@/lib/zettel/slug";
import { asStringArray, type PropertyJson } from "@/lib/zettel/values";
import { tagChipStyle } from "@/lib/ui/tag-color";
import {
  CaretDown,
  CaretRight,
  Eye,
  MarkdownLogo,
  NotePencil,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { BlockEditor } from "./block-editor";
import { MarkdownPreview } from "./markdown-preview";

export type EditorProperty = {
  defId: string;
  key: string;
  valueType: string;
  options: unknown;
  isSystem: boolean;
  value: unknown;
};

export type EditorNote = {
  id: string;
  type: string;
  title: string;
  slug: string;
  body: string;
  properties: EditorProperty[];
  linkedPatterns: { id: string; title: string; slug: string }[];
  backlinks: {
    id: string;
    title: string;
    slug: string;
    type: string;
    kind: string;
  }[];
};

const BODY_AUTOSAVE_MS = 600;
const PROPERTIES_OPEN_KEY = "note-properties-open";

type EditorView = "edit" | "markdown" | "preview";

export function NoteEditor({
  note,
  patternTitles,
  codeTheme,
  breadcrumb,
}: {
  note: EditorNote;
  patternTitles: string[];
  codeTheme: CodeTheme;
  breadcrumb?: ReactNode;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [view, setView] = useState<EditorView>("edit");
  const lastSaved = useRef({ title: note.title, body: note.body });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  titleRef.current = title;
  bodyRef.current = body;

  const visible = note.properties.filter((prop) => !prop.isSystem);
  const assigned = visible.filter((prop) => prop.value != null);
  const available = visible.filter((prop) => prop.value == null);
  const patternProperty = note.properties.find(
    (prop) => prop.key === PATTERN_PROPERTY_KEY,
  );
  const patternValues = asStringArray(patternProperty?.value);

  useEffect(() => {
    setTitle(note.title);
    setBody(note.body);
    lastSaved.current = { title: note.title, body: note.body };
  }, [note.id]);

  useEffect(() => {
    try {
      setPropertiesOpen(window.localStorage.getItem(PROPERTIES_OPEN_KEY) !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function toggleProperties() {
    setPropertiesOpen((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(PROPERTIES_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function savePatternValues(values: string[]) {
    if (!patternProperty) return;
    run(() => setNotePropertyAction(note.id, patternProperty.defId, values));
  }

  function flushSave(next?: { title?: string; body?: string }) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const nextTitle = next?.title ?? titleRef.current;
    const nextBody = next?.body ?? bodyRef.current;
    if (
      nextTitle === lastSaved.current.title &&
      nextBody === lastSaved.current.body
    ) {
      return;
    }
    lastSaved.current = { title: nextTitle, body: nextBody };
    startTransition(async () => {
      setError(null);
      const result = await updateNoteAction(note.id, {
        title: nextTitle,
        body: nextBody,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.href && result.href !== window.location.pathname) {
        router.replace(result.href);
        return;
      }
      if (next?.body === undefined || next.title !== undefined) {
        router.refresh();
      }
    });
  }

  function scheduleTitleSave(value: string) {
    setTitle(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed) flushSave({ title: trimmed });
    }, BODY_AUTOSAVE_MS);
  }

  function scheduleBodySave(markdown: string) {
    setBody(markdown);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushSave({ body: markdown });
    }, BODY_AUTOSAVE_MS);
  }

  return (
    <>
      <main
        data-note-page
        className="flex min-h-0 min-w-0 flex-1 flex-col px-5 pb-8 pt-6 lg:h-screen lg:overflow-hidden"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[52rem] flex-1 flex-col gap-3 lg:overflow-hidden">
          <div className="flex shrink-0 items-start justify-between gap-3">
            {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : <span />}
            <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-ctp-mantle p-0.5">
              {(
                [
                  ["edit", "Edit", NotePencil],
                  ["markdown", "Markdown", MarkdownLogo],
                  ["preview", "Preview", Eye],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${
                    view === id
                      ? "bg-ctp-surface0 text-ctp-text"
                      : "text-ctp-overlay0 hover:text-ctp-subtext0"
                  }`}
                >
                  <Icon size={20} weight={view === id ? "fill" : "bold"} />
                </button>
              ))}
            </div>
          </div>
          <input
            value={title}
            aria-label="Title"
            placeholder="Untitled"
            onChange={(event) => scheduleTitleSave(event.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== lastSaved.current.title) {
                flushSave({ title: title.trim() });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            className="w-full shrink-0 border-0 bg-transparent pb-3 font-sans text-4xl font-bold leading-tight text-ctp-text caret-ctp-lavender outline-none placeholder:text-ctp-overlay0"
          />
          {view === "edit" ? (
            <BlockEditor
              key={`${note.id}-edit`}
              initialMarkdown={body}
              codeTheme={codeTheme}
              onMarkdownChange={scheduleBodySave}
              onRequestSave={(markdown) => {
                setBody(markdown);
                flushSave({ body: markdown });
              }}
            />
          ) : null}
          {view === "markdown" ? (
            <textarea
              value={body}
              onChange={(event) => scheduleBodySave(event.target.value)}
              onBlur={() => flushSave({ body: bodyRef.current })}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-transparent font-mono text-sm leading-6 text-ctp-text caret-ctp-lavender outline-none"
              placeholder="# Markdown"
            />
          ) : null}
          {view === "preview" ? <MarkdownPreview markdown={body} /> : null}
          {error ? <p className="shrink-0 text-sm text-ctp-red">{error}</p> : null}

          {note.type === "pattern" ? (
            <div className="shrink-0 overflow-y-auto">
              <Backlinks backlinks={note.backlinks} />
            </div>
          ) : null}
        </div>
      </main>

      <NoteRightSidebar>
        <div className="flex flex-col gap-4">
          <div>
            <button
              type="button"
              onClick={toggleProperties}
              aria-expanded={propertiesOpen}
              className="flex w-full items-center justify-between gap-2 font-mono text-xs uppercase tracking-wide text-ctp-mauve hover:text-ctp-lavender"
            >
              <span>Properties</span>
              {propertiesOpen ? (
                <CaretDown size={16} weight="bold" className="text-ctp-overlay0" />
              ) : (
                <CaretRight size={16} weight="bold" className="text-ctp-overlay0" />
              )}
            </button>
            {propertiesOpen ? (
              <div className="mt-3 space-y-4">
                {assigned.map((prop) => (
                  <PropertyField
                    key={`${prop.defId}:${JSON.stringify(prop.value)}`}
                    property={prop}
                    patternTitles={patternTitles}
                    disabled={pending}
                    onSave={(value) =>
                      run(() => setNotePropertyAction(note.id, prop.defId, value))
                    }
                    onRemove={() =>
                      run(() => removeNotePropertyAction(note.id, prop.defId))
                    }
                  />
                ))}
                {available.length > 0 ? (
                  <AddPropertySelect
                    properties={available}
                    disabled={pending}
                    onAdd={(prop) => {
                      const initial =
                        prop.valueType === "checkbox"
                          ? false
                          : prop.valueType === "wikilink_list" ||
                              prop.valueType === "multi_select" ||
                              prop.key === PATTERN_PROPERTY_KEY
                            ? []
                            : prop.valueType === "number"
                              ? 0
                              : "";
                      run(() =>
                        setNotePropertyAction(
                          note.id,
                          prop.defId,
                          initial as PropertyJson,
                        ),
                      );
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {patternProperty ? (
            <LinkedTagHubs
              patterns={note.linkedPatterns}
              values={patternValues}
              suggestions={patternTitles}
              disabled={pending}
              onChange={savePatternValues}
            />
          ) : (
            <LinkedTagHubsReadOnly patterns={note.linkedPatterns} />
          )}
        </div>
      </NoteRightSidebar>
    </>
  );
}

function LinkedTagHubs({
  patterns,
  values,
  suggestions,
  disabled,
  onChange,
}: {
  patterns: EditorNote["linkedPatterns"];
  values: string[];
  suggestions: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
}) {
  const hrefByTitle = new Map(
    patterns.map((pattern) => [pattern.title, noteHref("pattern", pattern.slug)]),
  );

  return (
    <div>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-ctp-overlay0">
        Linked tag hubs
      </h2>
      <ThemedMultiSelect
        values={values}
        suggestions={suggestions}
        disabled={disabled}
        placeholder="Add pattern…"
        onChange={onChange}
        getHref={(title) => hrefByTitle.get(title)}
      />
    </div>
  );
}

function LinkedTagHubsReadOnly({
  patterns,
}: {
  patterns: EditorNote["linkedPatterns"];
}) {
  return (
    <div>
      <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-overlay0">
        Linked tag hubs
      </h2>
      {patterns.length === 0 ? (
        <p className="mt-2 text-sm text-ctp-overlay0">No linked tag hubs yet.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {patterns.map((pattern) => (
            <li key={pattern.id}>
              <Link
                href={noteHref("pattern", pattern.slug)}
                className="tag-chip inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-xs hover:opacity-90"
                style={tagChipStyle(pattern.title)}
              >
                {pattern.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Backlinks({
  backlinks,
}: {
  backlinks: EditorNote["backlinks"];
}) {
  return (
    <div>
      <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-overlay0">
        Backlinks
      </h2>
      {backlinks.length === 0 ? (
        <p className="mt-2 text-sm text-ctp-overlay0">No incoming links yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {backlinks.map((link) => (
            <li key={`${link.kind}-${link.id}`}>
              <Link
                href={noteHref(link.type, link.slug)}
                className="text-sm text-ctp-blue hover:text-ctp-sky"
              >
                {link.title}
              </Link>
              <span className="ml-2 font-mono text-xs text-ctp-overlay0">
                {link.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddPropertySelect({
  properties,
  disabled,
  onAdd,
}: {
  properties: EditorProperty[];
  disabled: boolean;
  onAdd: (property: EditorProperty) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-xs text-ctp-overlay0">Add property</span>
      <select
        disabled={disabled}
        defaultValue=""
        onChange={(event) => {
          const next = properties.find((prop) => prop.defId === event.target.value);
          event.target.value = "";
          if (next) onAdd(next);
        }}
        className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm text-ctp-text"
      >
        <option value="">Choose…</option>
        {properties.map((prop) => (
          <option key={prop.defId} value={prop.defId}>
            {prop.key}
          </option>
        ))}
      </select>
    </label>
  );
}

function PropertyField({
  property,
  patternTitles,
  disabled,
  onSave,
  onRemove,
}: {
  property: EditorProperty;
  patternTitles: string[];
  disabled: boolean;
  onSave: (value: PropertyJson | null) => void;
  onRemove: () => void;
}) {
  const options = asStringArray(property.options);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ctp-subtext0">{property.key}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-red"
          aria-label={`Remove ${property.key}`}
        >
          <Trash size={18} weight="bold" />
        </button>
      </div>
      <FieldControl
        property={property}
        options={options}
        patternTitles={patternTitles}
        disabled={disabled}
        onSave={onSave}
      />
    </div>
  );
}

function FieldControl({
  property,
  options,
  patternTitles,
  disabled,
  onSave,
}: {
  property: EditorProperty;
  options: string[];
  patternTitles: string[];
  disabled: boolean;
  onSave: (value: PropertyJson | null) => void;
}) {
  const value = property.value;
  const isPattern =
    property.key === PATTERN_PROPERTY_KEY ||
    property.valueType === "wikilink_list" ||
    property.valueType === "multi_select";

  if (isPattern) {
    const suggestions =
      property.valueType === "multi_select" ? options : patternTitles;
    return (
      <ThemedMultiSelect
        values={asStringArray(value)}
        suggestions={suggestions}
        disabled={disabled}
        placeholder={
          property.key === PATTERN_PROPERTY_KEY ? "Add pattern…" : "Add…"
        }
        onChange={onSave}
      />
    );
  }

  switch (property.valueType) {
    case "select":
      return (
        <select
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onSave(event.target.value || null)}
          className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <input
          type="checkbox"
          disabled={disabled}
          checked={Boolean(value)}
          onChange={(event) => onSave(event.target.checked)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          disabled={disabled}
          defaultValue={typeof value === "number" ? value : ""}
          onBlur={(event) => {
            const next = event.target.value;
            onSave(next === "" ? null : Number(next));
          }}
          className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 font-mono text-sm"
        />
      );
    case "date":
      return (
        <input
          type="date"
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onSave(event.target.value || null)}
          className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 font-mono text-sm"
        />
      );
    case "wikilink":
      return (
        <input
          type="text"
          disabled={disabled}
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(event) => onSave(event.target.value)}
          className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
        />
      );
    default:
      return (
        <textarea
          disabled={disabled}
          defaultValue={typeof value === "string" ? value : ""}
          rows={3}
          onBlur={(event) => onSave(event.target.value)}
          className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
        />
      );
  }
}
