/**
 * components/FloatingNote.tsx
 *
 * The floating note panel that overlays web pages.
 * Rendered inside a Shadow DOM root (see content.tsx).
 *
 * BUG FIXES IN THIS VERSION
 * ──────────────────────────
 * Fix 1 – Keyboard events leaking to the host page
 *   Problem: YouTube intercepts Space/arrow keys for video playback.
 *            GitHub intercepts "/" to focus its search box.
 *            Typing in our textarea triggered both.
 *   Fix:    stopPropagation() + stopImmediatePropagation() on ALL keyboard
 *           events that originate inside our panel. We also capture at the
 *           shadow-host level in content.tsx for belt-and-suspenders safety.
 *
 * Fix 2 – Clear button leaves an "(empty note)" ghost in the popup
 *   Problem: handleClear was calling saveNote(url, "") which writes an entry
 *            with an empty string — still visible in the popup as "(empty note)".
 *   Fix:    handleClear now calls deleteNote(url) to fully remove the entry.
 *
 * Fix 3 – Stale note shown when reopening the panel
 *   Problem: The component kept the previous note in state when closed and
 *            reopened on the SAME page after clearing.
 *   Fix:    Reset note state to "" before loading from storage on every open.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getNote, saveNote, deleteNote } from "../storage/storage";

interface FloatingNoteProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function FloatingNote({ isVisible, onClose }: FloatingNoteProps) {
  const [note, setNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isDark, setIsDark] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Snapshot the URL at mount time (URL doesn't change while panel is open)
  const currentUrl = window.location.href;

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Load note on open (always reset first to avoid stale state) ────────────
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    // Reset to empty immediately so the user never sees a stale value
    // while the async storage read is in flight
    setNote("");
    setSaveStatus("idle");

    getNote(currentUrl).then((entry) => {
      if (!cancelled) {
        setNote(entry?.note ?? "");
      }
    });

    return () => { cancelled = true; };
  }, [isVisible, currentUrl]);

  // ── Focus textarea on open ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isVisible]);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    // capture:true so we see it before anything else on the page
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [isVisible, onClose]);

  // ── Append text from right-click context menu ──────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setNote((prev) => {
        const next = prev ? `${prev}\n\n${text}` : text;
        // Fire-and-forget save
        saveNote(currentUrl, next, document.title);
        return next;
      });
    };
    window.addEventListener("quicknote:append", handler);
    return () => window.removeEventListener("quicknote:append", handler);
  }, [currentUrl]);

  // ── Debounced auto-save ────────────────────────────────────────────────────
  const triggerSave = useCallback(
    (value: string) => {
      clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        await saveNote(currentUrl, value, document.title);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }, 500);
    },
    [currentUrl]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setNote(value);
      triggerSave(value);
    },
    [triggerSave]
  );

  // ── Clear: fully delete the entry from storage (not save empty string) ─────
  const handleClear = useCallback(async () => {
    clearTimeout(saveTimerRef.current);
    setNote("");
    setSaveStatus("saving");
    // deleteNote removes the key entirely — no "(empty note)" left in popup
    await deleteNote(currentUrl);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 1500);
    textareaRef.current?.focus();
  }, [currentUrl]);

  // ── Swallow ALL keyboard events so they never reach the host page ──────────
  //
  // This is the core fix for Bug 2.
  //
  // Even though we're inside a Shadow DOM, keyboard events still bubble up
  // through the shadow boundary to the host document. YouTube, GitHub, and
  // many other SPAs attach global keydown listeners that intercept keys like:
  //   Space  → YouTube play/pause
  //   /      → GitHub search focus
  //   j/k    → navigation on Reddit, GitHub, etc.
  //   f      → fullscreen on video players
  //
  // We must stop ALL keyboard events that originate inside our panel from
  // reaching the host document.
  const stopKeys = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    // stopImmediatePropagation prevents other listeners on the same element
    (e.nativeEvent as KeyboardEvent).stopImmediatePropagation();
  }, []);

  if (!isVisible) return null;

  const dark = isDark;

  return (
    <div
      className="qn-animate-in"
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 2147483647,
        width: "320px",
        fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        fontSize: "14px",
        lineHeight: 1.5,
        background: dark ? "#18181b" : "#ffffff",
        border: `1px solid ${dark ? "#3f3f46" : "#e4e4e7"}`,
        borderRadius: "16px",
        boxShadow: dark
          ? "0 8px 40px rgba(0,0,0,0.5), 0 2px 12px rgba(0,0,0,0.4)"
          : "0 8px 40px rgba(0,0,0,0.12), 0 2px 12px rgba(0,0,0,0.06)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      // Stop mouse events reaching the page (prevents accidental clicks/drags)
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      // Stop ALL keyboard events from bubbling to the host document
      onKeyDown={stopKeys}
      onKeyUp={stopKeys}
      onKeyPress={stopKeys}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 10px",
          borderBottom: `1px solid ${dark ? "#3f3f46" : "#f4f4f5"}`,
          background: dark
            ? "linear-gradient(135deg, #27272a, #18181b)"
            : "linear-gradient(135deg, #f9fafb, #ffffff)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            📝
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: dark ? "#f4f4f5" : "#18181b",
              letterSpacing: "-0.01em",
            }}
          >
            QuickNote
          </span>

          {saveStatus === "saving" && (
            <span
              className="qn-fade-in"
              style={{ fontSize: "11px", color: "#6366f1", fontWeight: 500 }}
            >
              saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span
              className="qn-fade-in"
              style={{ fontSize: "11px", color: "#22c55e", fontWeight: 500 }}
            >
              ✓ saved
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            color: dark ? "#71717a" : "#a1a1aa",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = dark ? "#3f3f46" : "#f4f4f5";
            (e.currentTarget as HTMLButtonElement).style.color = dark ? "#f4f4f5" : "#18181b";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = dark ? "#71717a" : "#a1a1aa";
          }}
        >
          ✕
        </button>
      </div>

      {/* ── URL badge ────────────────────────────────────────────────────── */}
      <div style={{ padding: "8px 16px 0" }}>
        <div
          style={{
            fontSize: "11px",
            color: dark ? "#52525b" : "#a1a1aa",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={currentUrl}
        >
          {currentUrl}
        </div>
      </div>

      {/* ── Textarea ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "10px 14px" }}>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={handleChange}
          // Key events on the textarea are already stopped by the parent div's
          // onKeyDown/onKeyUp, but we add it here too for absolute certainty.
          onKeyDown={stopKeys}
          onKeyUp={stopKeys}
          onKeyPress={stopKeys}
          placeholder="Start typing… your note auto-saves."
          rows={8}
          style={{
            width: "100%",
            resize: "none",
            border: `1px solid ${dark ? "#3f3f46" : "#e4e4e7"}`,
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "13px",
            lineHeight: 1.6,
            color: dark ? "#e4e4e7" : "#18181b",
            background: dark ? "#09090b" : "#fafafa",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#6366f1";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = dark ? "#3f3f46" : "#e4e4e7";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px 12px",
        }}
      >
        <span style={{ fontSize: "11px", color: dark ? "#52525b" : "#a1a1aa" }}>
          {note.length.toLocaleString()} chars
        </span>

        <button
          onClick={handleClear}
          disabled={!note}
          style={{
            fontSize: "12px",
            padding: "3px 10px",
            borderRadius: "6px",
            border: `1px solid ${dark ? "#3f3f46" : "#fecaca"}`,
            background: "transparent",
            color: note ? "#f87171" : dark ? "#3f3f46" : "#d4d4d8",
            cursor: note ? "pointer" : "default",
            fontFamily: "inherit",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (note) {
              (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2";
              (e.currentTarget as HTMLButtonElement).style.color = "#dc2626";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = note
              ? "#f87171"
              : dark ? "#3f3f46" : "#d4d4d8";
          }}
        >
          Clear
        </button>
      </div>

      {/* ── Keyboard hint ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "6px 16px 10px",
          borderTop: `1px solid ${dark ? "#27272a" : "#f4f4f5"}`,
          fontSize: "10px",
          color: dark ? "#3f3f46" : "#d4d4d8",
          textAlign: "center",
        }}
      >
        Press <kbd style={{ fontFamily: "monospace" }}>Esc</kbd> or{" "}
        <kbd style={{ fontFamily: "monospace" }}>Ctrl+Shift+Y</kbd> to close
      </div>
    </div>
  );
}
