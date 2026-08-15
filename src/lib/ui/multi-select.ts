export function filterMultiSelectOptions(
  options: string[],
  selected: string[],
  query: string,
): string[] {
  const selectedSet = new Set(selected);
  const needle = query.trim().toLowerCase();
  return options.filter((item) => {
    if (selectedSet.has(item)) return false;
    if (!needle) return true;
    return item.toLowerCase().includes(needle);
  });
}

export function addMultiSelectValue(selected: string[], raw: string): string[] {
  const next = raw.trim();
  if (!next || selected.includes(next)) return selected;
  return [...selected, next];
}

export function removeMultiSelectValue(
  selected: string[],
  value: string,
): string[] {
  return selected.filter((item) => item !== value);
}
