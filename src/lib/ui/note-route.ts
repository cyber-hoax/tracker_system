/**
 * Detail routes that render the note editor (right properties rail).
 * List pages (`/dsa`, `/patterns`) are excluded.
 */
export function isNoteRoute(pathname: string): boolean {
  return /^\/(dsa|patterns|notes)\/[^/]+$/.test(pathname);
}

export function isFullBleedRoute(pathname: string): boolean {
  return isNoteRoute(pathname) || pathname === "/chat" || pathname === "/graph";
}
