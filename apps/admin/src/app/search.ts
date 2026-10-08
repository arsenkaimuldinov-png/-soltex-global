/** ⌘K matching, kept free of React so it can be unit-tested. */
/** Case-insensitive match on every word of the query. */
export function matches(cmd: { label: string; keywords: string; hint?: string }, query: string): boolean {
  const hay = `${cmd.label} ${cmd.hint ?? ''} ${cmd.keywords}`.toLocaleLowerCase('ru');
  return query
    .toLocaleLowerCase('ru')
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}
