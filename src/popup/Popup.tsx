/**
 * popup/Popup.tsx
 *
 * The extension toolbar popup (appears when the user clicks the icon).
 *
 * Displays:
 *  • A list of all saved notes (URL, title, preview, timestamp)
 *  • Per-note delete button
 *  • "Open current page note" quick-action button
 *  • Empty-state illustration when no notes exist
 *  • Search / filter notes by URL or content
 *
 * The popup runs as its OWN page (popup.html), not inside a content script.
 * It has full access to chrome.storage.local via the storage utilities.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAllNotes,
  deleteNote,
  clearAllNotes,
  type NoteEntry,
} from "../storage/storage";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function hostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center select-none">
      <div className="text-5xl mb-4 opacity-80">📋</div>
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
        No notes yet
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
        Press{" "}
        <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1 py-0.5 rounded text-[10px] border border-zinc-200 dark:border-zinc-700">
          Ctrl+Shift+Y
        </kbd>{" "}
        on any page to open the floating note panel.
      </p>
    </div>
  );
}

interface NoteCardProps {
  entry: NoteEntry;
  onDelete: (url: string) => void;
  onOpen: (url: string) => void;
}

function NoteCard({ entry, onDelete, onOpen }: NoteCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(entry.url);
    } else {
      setConfirmDelete(true);
      // Auto-cancel confirmation after 3 s
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/60 rounded-xl p-3 hover:border-indigo-200 dark:hover:border-indigo-600/50 hover:shadow-md transition-all duration-150">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate leading-tight"
            title={entry.title || entry.url}
          >
            {entry.title && entry.title !== entry.url
              ? truncate(entry.title, 44)
              : hostname(entry.url)}
          </p>
          <p
            className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5"
            title={entry.url}
          >
            {entry.url}
          </p>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Open page */}
          <button
            onClick={() => onOpen(entry.url)}
            title="Open page"
            className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors text-xs"
          >
            ↗
          </button>
          {/* Delete */}
          <button
            onClick={handleDeleteClick}
            title={confirmDelete ? "Click again to confirm delete" : "Delete note"}
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors ${
              confirmDelete
                ? "bg-red-100 dark:bg-red-900/40 text-red-500"
                : "text-zinc-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            }`}
          >
            {confirmDelete ? "!" : "✕"}
          </button>
        </div>
      </div>

      {/* Note preview */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 whitespace-pre-wrap break-words">
        {entry.note.trim() || (
          <span className="italic text-zinc-300 dark:text-zinc-600">
            (empty note)
          </span>
        )}
      </p>

      {/* Timestamp */}
      <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-2 text-right">
        {formatDate(entry.timestamp)}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Popup() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const all = await getAllNotes();
    setNotes(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (url: string) => {
    await deleteNote(url);
    setNotes((prev) => prev.filter((n) => n.url !== url));
  }, []);

  const handleOpen = useCallback((url: string) => {
    chrome.tabs.create({ url });
  }, []);

  const handleClearAll = useCallback(async () => {
    if (showClearConfirm) {
      await clearAllNotes();
      setNotes([]);
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  }, [showClearConfirm]);

  const handleOpenCurrentPage = useCallback(async () => {
    // Query the active tab and send a TOGGLE message to it
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_QUICKNOTE" });
      } catch {
        // Content script not available on this page (e.g. chrome:// pages)
      }
    }
    // Close the popup
    window.close();
  }, []);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.url.toLowerCase().includes(q) ||
        n.note.toLowerCase().includes(q) ||
        (n.title || "").toLowerCase().includes(q)
    );
  }, [notes, search]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-[360px] min-h-[200px] max-h-[560px] flex flex-col bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-sm shadow-sm">
            📝
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
              QuickNote
            </h1>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-none">
              {loading ? "loading…" : `${notes.length} note${notes.length !== 1 ? "s" : ""} saved`}
            </p>
          </div>
        </div>

        {/* Open current page note button */}
        <button
          onClick={handleOpenCurrentPage}
          title="Toggle note on current page"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-sm"
        >
          <span>+ Note</span>
        </button>
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      {notes.length > 0 && (
        <div className="px-3 pt-3 pb-0">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Notes list ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          search ? (
            <p className="text-center text-xs text-zinc-400 py-8">
              No notes matching &ldquo;{search}&rdquo;
            </p>
          ) : (
            <EmptyState />
          )
        ) : (
          filtered.map((entry) => (
            <NoteCard
              key={entry.url}
              entry={entry}
              onDelete={handleDelete}
              onOpen={handleOpen}
            />
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {notes.length > 0 && !loading && (
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {filtered.length !== notes.length
              ? `${filtered.length} of ${notes.length} shown`
              : `${notes.length} note${notes.length !== 1 ? "s" : ""}`}
          </p>
          <button
            onClick={handleClearAll}
            className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${
              showClearConfirm
                ? "bg-red-100 dark:bg-red-900/40 text-red-500"
                : "text-zinc-400 hover:text-red-400 dark:hover:text-red-400"
            }`}
          >
            {showClearConfirm ? "Tap again to clear all" : "Clear all"}
          </button>
        </div>
      )}
    </div>
  );
}
