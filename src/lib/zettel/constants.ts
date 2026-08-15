/** Keys hidden from the default note editor; still stored and shown as locked in Settings. */
export const SYSTEM_PROPERTY_KEYS = ["notion-id", "base"] as const;

/** Wikilink_list whose targets become `links.kind = 'pattern'`. */
export const PATTERN_PROPERTY_KEY = "Pattern";

export const PATTERN_SLUG_PREFIX = "patterns-";

export const WIKILINK_VALUE_TYPES = ["wikilink", "wikilink_list"] as const;

export type SystemPropertyKey = (typeof SYSTEM_PROPERTY_KEYS)[number];
