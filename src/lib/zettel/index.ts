/**
 * Zettelkasten notes + EAV properties.
 *
 * Contracts for graph, search, and Obsidian-sync agents:
 *
 * 1. Property JSONB (`note_properties.value`)
 *    text/date/select/wikilink → string
 *    number → number
 *    checkbox → boolean (false is stored)
 *    multi_select/wikilink_list → string[]
 *    Dates are `YYYY-MM-DD`. Wikilinks are unbracketed; Pattern values
 *    strip a leading `Patterns/` folder (`binary search` not `Patterns/binary search`).
 *
 * 2. Links are derived from properties, not a separate tagging UI.
 *    Call `syncPropertyLinks(noteId)` after any wikilink-typed property write.
 *    `Pattern` → `links.kind = 'pattern'` (stub pattern notes are created).
 *    Other wikilink/wikilink_list defs → `kind = 'wikilink'` (no stub).
 *    Never delete `kind = 'manual'` here.
 *
 * 3. Slugs are globally unique (`notes_slug_idx`).
 *    Problems: `slugify(title)`. Patterns: `patterns-${slugify(title)}`.
 *    Routes: `/dsa/[slug]` (raw slug), `/patterns/[slug]` (prefix stripped).
 *
 * 4. System defs `notion-id` and `base` stay hidden in the note editor.
 *    `file_path` stores the vault-relative markdown path (Obsidian sync). Search uses `notes.search_vector`
 *    (maintained by DB triggers on title/body/properties). Do not recompute
 *    the vector in app code. Graph edges are `links` rows from
 *    `syncPropertyLinks` (plus `manual`); do not add a second edge table.
 *
 * 5. Deleting a property_def cascade-deletes values; this module then resyncs
 *    links for affected notes. Do not delete system defs.
 */
export { PATTERN_PROPERTY_KEY, SYSTEM_PROPERTY_KEYS } from "./constants";
export {
  noteHref,
  patternDbSlug,
  patternUrlSlug,
  slugify,
} from "./slug";
export { parseWikilink, canonicalWikilinkTarget } from "./wikilink";
export { parsePropertyValue, isWikilinkType } from "./values";
export { syncPropertyLinks } from "./links";
export {
  createNote,
  getNoteByRoute,
  isHiddenEditorKey,
  listPatternTitles,
  listPatterns,
  listProblems,
  listPropertyDefs,
  listVisiblePropertyDefs,
  removeNoteProperty,
  setNoteProperty,
  setNoteProperties,
  updateNote,
} from "./notes";
export type {
  NoteDetail,
  PatternListItem,
  ProblemListItem,
} from "./notes";
export {
  hasActiveFilters,
  hasSearchInput,
  parseSearchFilters,
  parseSearchQuery,
  websearchQuery,
} from "./query";
export type { ProblemFilters, SearchQuery } from "./query";
export { searchNotes } from "./search";
export type { SearchHit } from "./search";
export { getGraphData } from "./graph";
export type { GraphData, GraphLink, GraphNode } from "./graph";
export {
  createPropertyDef,
  deletePropertyDef,
  updatePropertyDefOptions,
} from "./property-defs";
