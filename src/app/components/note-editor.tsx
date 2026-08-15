"use client";

import {
  removeNotePropertyAction,
  setNotePropertyAction,
  updateNoteAction,
} from "@/app/actions/zettel";
import { noteHref } from "@/lib/zettel/slug";
import { asStringArray, type PropertyJson } from "@/lib/zettel/values";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SegmentChip } from "./segment-chip";

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

export function NoteEditor({
  note,
  patternTitles,
}: {
  note: EditorNote;
  patternTitles: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visible = note.properties.filter((prop) => !prop.isSystem);
  const assigned = visible.filter((prop) => prop.value != null);
  const available = visible.filter((prop) => prop.value == null);

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

  function saveIdentity() {
    run(() => updateNoteAction(note.id, { title, body }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-4">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title.trim() && title.trim() !== note.title) saveIdentity();
          }}
          className="w-full border-0 border-b border-ctp-surface0 bg-transparent pb-2 text-2xl text-ctp-text focus:border-ctp-mauve focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "s") {
              event.preventDefault();
              saveIdentity();
            }
          }}
          spellCheck={false}
          className="min-h-[28rem] w-full resize-y border border-ctp-surface0 bg-ctp-base p-4 font-mono text-sm text-ctp-text focus:border-ctp-blue focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={saveIdentity}
            className="bg-ctp-blue px-3 py-2 font-mono text-xs text-ctp-crust hover:bg-ctp-sapphire disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save body"}
          </button>
          <p className="font-mono text-xs text-ctp-overlay0">⌘S</p>
        </div>
        {error ? <p className="text-sm text-ctp-red">{error}</p> : null}

        {note.linkedPatterns.length > 0 ? (
          <div>
            <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-overlay0">
              Linked pattern hubs
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {note.linkedPatterns.map((pattern) => (
                <li key={pattern.id}>
                  <Link href={noteHref("pattern", pattern.slug)}>
                    <SegmentChip kind="pattern" value={pattern.title} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {note.type === "pattern" ? (
          <Backlinks backlinks={note.backlinks} />
        ) : null}
      </section>

      <aside className="space-y-4 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Properties
        </h2>
        <div className="space-y-4">
          {assigned.map((prop) => (
            <PropertyField
              key={`${prop.defId}:${JSON.stringify(prop.value)}`}
              noteId={note.id}
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
        </div>
        {available.length > 0 ? (
          <AddPropertySelect
            properties={available}
            disabled={pending}
            onAdd={(prop) => {
              const initial =
                prop.valueType === "checkbox"
                  ? false
                  : prop.valueType === "wikilink_list" ||
                      prop.valueType === "multi_select"
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
      </aside>
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
  noteId,
  property,
  patternTitles,
  disabled,
  onSave,
  onRemove,
}: {
  noteId: string;
  property: EditorProperty;
  patternTitles: string[];
  disabled: boolean;
  onSave: (value: PropertyJson | null) => void;
  onRemove: () => void;
}) {
  const options = asStringArray(property.options);
  const listId = `${noteId}-${property.defId}-patterns`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ctp-subtext0">{property.key}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="font-mono text-[10px] text-ctp-overlay0 hover:text-ctp-red"
        >
          Remove
        </button>
      </div>
      <FieldControl
        property={property}
        options={options}
        listId={listId}
        patternTitles={patternTitles}
        disabled={disabled}
        onSave={onSave}
      />
      {(property.valueType === "wikilink_list" ||
        property.key === "Pattern") &&
      patternTitles.length > 0 ? (
        <datalist id={listId}>
          {patternTitles.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

function FieldControl({
  property,
  options,
  listId,
  patternTitles,
  disabled,
  onSave,
}: {
  property: EditorProperty;
  options: string[];
  listId: string;
  patternTitles: string[];
  disabled: boolean;
  onSave: (value: PropertyJson | null) => void;
}) {
  const value = property.value;

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
    case "multi_select":
      return (
        <ChipList
          values={asStringArray(value)}
          suggestions={options}
          disabled={disabled}
          onChange={onSave}
        />
      );
    case "wikilink_list":
      return (
        <ChipList
          values={asStringArray(value)}
          suggestions={patternTitles}
          listId={listId}
          disabled={disabled}
          onChange={onSave}
        />
      );
    case "wikilink":
      return (
        <input
          type="text"
          disabled={disabled}
          defaultValue={typeof value === "string" ? value : ""}
          list={listId}
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

function ChipList({
  values,
  suggestions,
  listId,
  disabled,
  onChange,
}: {
  values: string[];
  suggestions: string[];
  listId?: string;
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const unused = useMemo(
    () => suggestions.filter((item) => !values.includes(item)),
    [suggestions, values],
  );

  function add(raw: string) {
    const next = raw.trim();
    if (!next || values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1">
        {values.map((item) => (
          <li key={item}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(values.filter((value) => value !== item))}
              className="bg-ctp-mauve/20 px-2 py-0.5 font-mono text-xs text-ctp-mauve hover:bg-ctp-red/20 hover:text-ctp-red"
            >
              {item} ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <input
          value={draft}
          disabled={disabled}
          list={listId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
            }
          }}
          placeholder="Add…"
          className="min-w-0 flex-1 border border-ctp-surface1 bg-ctp-mantle px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={() => add(draft)}
          className="px-2 font-mono text-xs text-ctp-blue"
        >
          Add
        </button>
      </div>
      {unused.length > 0 && unused.length <= 12 ? (
        <div className="flex flex-wrap gap-1">
          {unused.slice(0, 8).map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => add(item)}
              className="font-mono text-[10px] text-ctp-overlay0 hover:text-ctp-text"
            >
              + {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
