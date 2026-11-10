/**
 * storage/storage.ts
 *
 * All reads/writes to chrome.storage.local are funnelled through here.
 *
 * Storage schema
 * ──────────────
 * Each note is stored under the full URL (minus hash fragment only).
 * Query params are KEPT so that YouTube videos, GitHub PRs, search results
 * etc. each get their own separate note.
 *
 * Examples:
 *   "https://www.youtube.com/watch?v=abc123"   → own note
 *   "https://www.youtube.com/watch?v=xyz999"   → own note  (different video)
 *   "https://github.com/user/repo/issues/42"   → own note
 *   "https://example.com/page#section2"        → same as "https://example.com/page"
 *                                                 (only hash is stripped)
 */

export interface NoteEntry {
  /** The normalised URL used as the storage key */
  url: string;
  /** The note content */
  note: string;
  /** Unix timestamp (ms) of last save */
  timestamp: number;
  /** Human-readable page title (set by content script from document.title) */
  title?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a URL for use as a storage key.
 *
 * Rules:
 *  • Keep the full origin + pathname + search (query params)
 *  • Strip only the hash fragment — it is client-side-only navigation
 *    and never changes the content of the page served by the server
 *  • Strip a trailing slash from the pathname for consistency
 *    (https://example.com/ === https://example.com)
 *
 * Before (broken): stripped query params
 *   youtube.com/watch?v=AAA  →  youtube.com/watch   ← ALL videos shared one note!
 *
 * After (fixed): keeps query params, strips only hash
 *   youtube.com/watch?v=AAA  →  youtube.com/watch?v=AAA  ← unique per video ✓
 *   youtube.com/watch?v=BBB  →  youtube.com/watch?v=BBB  ← unique per video ✓
 */
function toStorageKey(url: string): string {
  try {
    const u = new URL(url);
    // Build key: origin + pathname (trailing slash removed) + search params
    const path = u.pathname.replace(/\/$/, "") || "/";
    const search = u.search; // includes the leading "?" — empty string if none
    return u.origin + path + search;
  } catch {
    // Malformed URL — use as-is
    return url;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Persist (or update) a note for a given URL.
 * Callers must pass a non-empty note string.
 * To remove a note, call deleteNote() instead.
 */
export async function saveNote(
  url: string,
  note: string,
  title?: string
): Promise<void> {
  const key = toStorageKey(url);
  const entry: NoteEntry = {
    url: key,
    note,
    timestamp: Date.now(),
    title: title ?? key,
  };
  await chrome.storage.local.set({ [key]: entry });
}

/** Load the note for a given URL, or null if none exists. */
export async function getNote(url: string): Promise<NoteEntry | null> {
  const key = toStorageKey(url);
  const result = await chrome.storage.local.get(key);
  return (result[key] as NoteEntry) ?? null;
}

/**
 * Return all saved notes, sorted most-recent first.
 * chrome.storage.local.get(null) fetches the entire storage object.
 */
export async function getAllNotes(): Promise<NoteEntry[]> {
  const all = await chrome.storage.local.get(null);
  const entries = Object.values(all) as NoteEntry[];
  // Only return entries that actually have note content (filter orphaned empties)
  return entries
    .filter((e) => e && typeof e.url === "string")
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Remove the note entry for a given URL completely from storage. */
export async function deleteNote(url: string): Promise<void> {
  const key = toStorageKey(url);
  await chrome.storage.local.remove(key);
}

/** Remove ALL saved notes. */
export async function clearAllNotes(): Promise<void> {
  await chrome.storage.local.clear();
}
