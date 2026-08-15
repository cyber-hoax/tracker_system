import Link from "next/link";
import type { ProblemFilters } from "@/lib/zettel";

export function PropertyFilterForm({
  action,
  filters,
  statusOptions,
  difficultyOptions,
  patternTitles,
  q,
  showQuery = false,
  submitLabel = "Filter",
}: {
  action: string;
  filters: ProblemFilters;
  statusOptions: string[];
  difficultyOptions: string[];
  patternTitles: string[];
  q?: string;
  showQuery?: boolean;
  submitLabel?: string;
}) {
  const active = Boolean(
    q ||
      filters.status ||
      filters.difficulty ||
      filters.pattern ||
      filters.lastSolvedFrom ||
      filters.lastSolvedTo ||
      filters.nextRevisionFrom ||
      filters.nextRevisionTo,
  );

  return (
    <form
      className="grid gap-3 border border-ctp-surface0 bg-ctp-base p-4 md:grid-cols-4"
      method="get"
      action={action}
    >
      {showQuery ? (
        <label className="block space-y-1 md:col-span-4">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
            Query
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Full-text across title, body, and properties"
            className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
          />
        </label>
      ) : null}
      <FilterSelect
        name="status"
        label="Status"
        value={filters.status}
        options={statusOptions}
      />
      <FilterSelect
        name="difficulty"
        label="Difficulty"
        value={filters.difficulty}
        options={difficultyOptions}
      />
      <FilterSelect
        name="pattern"
        label="Pattern"
        value={filters.pattern}
        options={patternTitles}
      />
      <div className="grid grid-cols-2 gap-2 md:col-span-4 lg:col-span-1">
        <DateField
          name="lastSolvedFrom"
          label="Solved from"
          value={filters.lastSolvedFrom}
        />
        <DateField
          name="lastSolvedTo"
          label="Solved to"
          value={filters.lastSolvedTo}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:col-span-4 lg:col-span-1">
        <DateField
          name="nextRevisionFrom"
          label="Revise from"
          value={filters.nextRevisionFrom}
        />
        <DateField
          name="nextRevisionTo"
          label="Revise to"
          value={filters.nextRevisionTo}
        />
      </div>
      <div className="flex items-end gap-2 md:col-span-4">
        <button
          type="submit"
          className="bg-ctp-mauve px-3 py-2 font-mono text-xs text-ctp-crust"
        >
          {submitLabel}
        </button>
        {active ? (
          <Link
            href={action}
            className="px-3 py-2 font-mono text-xs text-ctp-overlay0 hover:text-ctp-text"
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: string[];
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={value ?? ""}
        className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 font-mono text-sm"
      />
    </label>
  );
}
