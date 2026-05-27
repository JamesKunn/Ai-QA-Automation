"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

const SURFACE_GRADIENT =
  "linear-gradient(180deg, rgba(16,13,22,0.95) 0%, rgba(8,6,11,0.98) 55%, rgba(10,8,14,0.98) 100%)";
const BUTTON_PRIMARY =
  "linear-gradient(180deg, #ddd6fe 0%, #c4b5fd 40%, #a78bfa 100%)";

const PAYLOAD_KEY = "qa.review.payload";
const EDITS_KEY = "qa.review.edits";

type Row = Record<string, string | number | boolean | null>;

type StoredPayload = {
  uploadedAt: string;
  files?: { name: string; size: number }[];
  n8nData: unknown;
};

type ColumnMeta = {
  key: string;
  /** Tailwind/inline width hint */
  widthClass: string;
  /** Approximate share of horizontal space — used by colgroup */
  widthPct: number;
};

function extractRows(data: unknown): Row[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.filter(
      (r): r is Row => r !== null && typeof r === "object" && !Array.isArray(r),
    );
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["epics", "data", "results", "items", "rows"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter(
          (r): r is Row =>
            r !== null && typeof r === "object" && !Array.isArray(r),
        );
      }
    }
    if (Object.keys(obj).length > 0 && !("raw" in obj)) {
      return [obj as Row];
    }
  }
  return [];
}

function deriveColumns(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) seen.add(k);
  }
  return Array.from(seen);
}

/** Heuristic: assign column widths based on common field-name shapes. */
function planColumns(columns: string[]): ColumnMeta[] {
  if (columns.length === 0) return [];
  const weights = columns.map((c) => {
    const lower = c.toLowerCase();
    if (/^id$|_id$|^#$/.test(lower)) return 1;
    if (lower === "status" || lower === "state") return 1;
    if (lower === "title" || lower === "name" || lower === "label") return 2.5;
    if (lower.includes("description") || lower.includes("summary") || lower.includes("notes"))
      return 5;
    return 2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return columns.map((key, i) => ({
    key,
    widthClass: "",
    widthPct: (weights[i] / total) * 100,
  }));
}

function toCellString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function statusTone(value: string): { dot: string; text: string; bg: string } {
  const v = value.trim().toLowerCase();
  if (["valid", "success", "ok", "passed", "pass", "done"].includes(v))
    return { dot: "#86efac", text: "#bbf7d0", bg: "rgba(34,197,94,0.12)" };
  if (["invalid", "error", "fail", "failed", "rejected"].includes(v))
    return { dot: "#fca5a5", text: "#fecaca", bg: "rgba(239,68,68,0.12)" };
  if (["pending", "processing", "in_progress", "review"].includes(v))
    return { dot: "#fcd34d", text: "#fef3c7", bg: "rgba(245,158,11,0.12)" };
  return { dot: "#c4b5fd", text: "#ddd6fe", bg: "rgba(167,139,250,0.12)" };
}

/** Auto-growing textarea: resizes to fit content, no resize handle. */
function AutoTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  edited?: boolean;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize(ref.current);
  }, [props.value, resize]);

  return (
    <textarea
      ref={ref}
      value={props.value}
      onChange={(e) => {
        props.onChange(e.target.value);
        resize(e.currentTarget);
      }}
      rows={1}
      aria-label={props.ariaLabel}
      className="w-full resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-relaxed text-[#f0ecf4] outline-none transition-colors focus:bg-[rgba(167,139,250,0.06)]"
      style={{
        boxShadow: props.edited
          ? "inset 2px 0 0 rgba(196,181,253,0.55)"
          : undefined,
      }}
    />
  );
}

export default function ReviewClient() {
  const [payload, setPayload] = useState<StoredPayload | null>(null);
  const [originalRows, setOriginalRows] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");

  // Hydrate from sessionStorage: prefer edits (so refresh keeps work).
  useEffect(() => {
    try {
      const rawPayload = sessionStorage.getItem(PAYLOAD_KEY);
      if (rawPayload) {
        const parsed = JSON.parse(rawPayload) as StoredPayload;
        setPayload(parsed);
        const original = extractRows(parsed.n8nData);
        setOriginalRows(original);

        const rawEdits = sessionStorage.getItem(EDITS_KEY);
        if (rawEdits) {
          try {
            const edited = JSON.parse(rawEdits) as Row[];
            setRows(Array.isArray(edited) ? edited : original);
          } catch {
            setRows(original);
          }
        } else {
          setRows(original);
        }
      }
    } catch (err) {
      console.error("Failed to read review payload:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist edits on every change (skip the initial empty render).
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(EDITS_KEY, JSON.stringify(rows));
    } catch {
      /* quota or disabled — silently ignore */
    }
  }, [rows, hydrated]);

  const columns = useMemo(() => deriveColumns(rows), [rows]);
  const columnPlan = useMemo(() => planColumns(columns), [columns]);

  // Track which (row, col) pairs differ from the original — for visual cue.
  const editedCells = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row, i) => {
      const orig = originalRows[i];
      if (!orig) {
        // new row — every filled cell is edited
        Object.keys(row).forEach((c) => {
          if (toCellString(row[c]) !== "") set.add(`${i}:${c}`);
        });
        return;
      }
      for (const c of columns) {
        if (toCellString(row[c]) !== toCellString(orig[c])) set.add(`${i}:${c}`);
      }
    });
    return set;
  }, [rows, originalRows, columns]);

  const editedCount = editedCells.size;

  const filteredIndices = useMemo(() => {
    if (!query.trim()) return rows.map((_, i) => i);
    const q = query.toLowerCase();
    return rows
      .map((_, i) => i)
      .filter((i) =>
        columns.some((c) => toCellString(rows[i][c]).toLowerCase().includes(q)),
      );
  }, [rows, columns, query]);

  function updateCell(rowIdx: number, col: string, value: string) {
    setRows((prev) => {
      const next = prev.slice();
      next[rowIdx] = { ...next[rowIdx], [col]: value };
      return next;
    });
  }

  function addRow() {
    if (columns.length === 0) {
      setRows([{ field: "" }]);
      return;
    }
    const blank: Row = {};
    for (const c of columns) blank[c] = "";
    setRows((prev) => [...prev, blank]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetAll() {
    setRows(originalRows);
    try {
      sessionStorage.removeItem(EDITS_KEY);
    } catch {}
  }

  function downloadXlsx() {
    const sheetData = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) out[c] = row[c] ?? "";
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(sheetData, { header: columns });
    // Set reasonable column widths in the .xlsx output
    ws["!cols"] = columnPlan.map((c) => ({
      wch: Math.max(
        c.key.length + 2,
        Math.min(60, Math.round(c.widthPct * 0.9)),
      ),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    XLSX.writeFile(wb, `qa-results-${stamp}.xlsx`);
  }

  if (!hydrated) {
    return (
      <div className="py-16 text-center text-sm text-[#8f8798]">Loading…</div>
    );
  }

  if (!payload || rows.length === 0) {
    return (
      <div
        className="rounded-2xl border px-6 py-12 text-center"
        style={{
          borderColor: "rgba(167, 139, 250, 0.22)",
          background: SURFACE_GRADIENT,
        }}
      >
        <p className="text-base font-medium text-[#f0ecf4]">
          No review data available.
        </p>
        <p className="mt-2 text-sm text-[#8f8798]">
          {payload
            ? "The processing response didn't include any rows we could display."
            : "Upload a file first to see results here."}
        </p>
        {payload?.n8nData != null && (
          <details className="mx-auto mt-6 max-w-xl text-left text-xs text-[#8f8798]">
            <summary className="cursor-pointer text-[#c4b5fd] hover:text-[#ddd6fe]">
              Show raw response
            </summary>
            <pre className="mt-3 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed">
              {JSON.stringify(payload.n8nData, null, 2)}
            </pre>
          </details>
        )}
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-2xl px-5 text-sm font-semibold"
          style={{
            border: "1px solid rgba(221,214,254,0.5)",
            color: "#1a0f2e",
            background: BUTTON_PRIMARY,
          }}
        >
          Back to upload
        </Link>
      </div>
    );
  }

  const statusColIdx = columns.findIndex((c) => c.toLowerCase() === "status");

  return (
    <div>
      {/* Metadata strip */}
      {payload.files && payload.files.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8f8798]">
          <span className="truncate text-[#c4b5fd]">
            {payload.files.map((f) => f.name).join(", ")}
          </span>
          <span className="opacity-50">•</span>
          <span>{new Date(payload.uploadedAt).toLocaleString()}</span>
          <span className="opacity-50">•</span>
          <span>
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </span>
          {editedCount > 0 && (
            <>
              <span className="opacity-50">•</span>
              <span className="text-[#ddd6fe]">
                {editedCount} unsaved edit{editedCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows…"
          className="w-full max-w-sm rounded-xl border px-3 py-2 text-sm text-[#f0ecf4] outline-none transition-colors placeholder:text-[#8f8798] focus:border-[#c4b5fd]/50"
          style={{
            background: "rgba(8,6,11,0.6)",
            borderColor: "rgba(167,139,250,0.22)",
          }}
        />
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "rgba(167, 139, 250, 0.22)",
          background: SURFACE_GRADIENT,
          boxShadow: "0 0 0 1px rgba(167,139,250,0.08) inset",
        }}
      >
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <colgroup>
              <col style={{ width: "3rem" }} />
              {columnPlan.map((c) => (
                <col key={c.key} style={{ width: `${c.widthPct}%` }} />
              ))}
              <col style={{ width: "2.5rem" }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr
                style={{
                  background:
                    "linear-gradient(180deg, rgba(20,16,28,0.98) 0%, rgba(16,12,22,0.98) 100%)",
                  borderBottom: "1px solid rgba(167,139,250,0.22)",
                  boxShadow: "0 1px 0 rgba(167,139,250,0.05)",
                }}
              >
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8f8798]">
                  #
                </th>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#c4b5fd]"
                  >
                    {c}
                  </th>
                ))}
                <th className="px-2 py-2.5" aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {filteredIndices.map((ri, displayIdx) => {
                const row = rows[ri];
                const zebra = displayIdx % 2 === 1;
                return (
                  <tr
                    key={ri}
                    className="group transition-colors hover:bg-[rgba(167,139,250,0.05)]"
                    style={{
                      background: zebra
                        ? "rgba(167,139,250,0.025)"
                        : "transparent",
                      borderBottom: "1px solid rgba(167,139,250,0.06)",
                    }}
                  >
                    <td className="px-3 py-2 align-top text-xs text-[#8f8798] tabular-nums">
                      {ri + 1}
                    </td>
                    {columns.map((c, ci) => {
                      const cellValue = toCellString(row[c]);
                      const isStatus = ci === statusColIdx;
                      const isEdited = editedCells.has(`${ri}:${c}`);

                      if (isStatus) {
                        const tone = statusTone(cellValue);
                        return (
                          <td key={c} className="px-3 py-2 align-top">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                                style={{ background: tone.bg, color: tone.text }}
                              >
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ background: tone.dot }}
                                />
                                {cellValue || "—"}
                              </span>
                              <input
                                value={cellValue}
                                onChange={(e) => updateCell(ri, c, e.target.value)}
                                className="w-0 flex-1 bg-transparent text-xs text-transparent outline-none focus:text-[#f0ecf4]"
                                aria-label={`Edit status for row ${ri + 1}`}
                              />
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={c} className="align-top">
                          <AutoTextarea
                            value={cellValue}
                            onChange={(v) => updateCell(ri, c, v)}
                            edited={isEdited}
                            ariaLabel={`${c} for row ${ri + 1}`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-1 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(ri)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 rounded-md px-2 py-1 text-xs text-[#8f8798] hover:bg-[rgba(232,168,200,0.1)] hover:text-[#f0a8c8]"
                        aria-label={`Remove row ${ri + 1}`}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredIndices.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="px-3 py-8 text-center text-sm text-[#8f8798]"
                  >
                    No rows match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold text-[#c4b5fd] transition-colors hover:text-[#ddd6fe]"
            style={{ borderColor: "rgba(167,139,250,0.35)" }}
          >
            ← Back
          </Link>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold text-[#c4b5fd] transition-colors hover:text-[#ddd6fe]"
            style={{ borderColor: "rgba(167,139,250,0.35)" }}
          >
            + Add row
          </button>
          {editedCount > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold text-[#8f8798] transition-colors hover:text-[#f0a8c8]"
              style={{ borderColor: "rgba(167,139,250,0.18)" }}
              title="Discard all edits and restore the original data"
            >
              Reset
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={downloadXlsx}
          className="inline-flex h-11 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition-[transform,box-shadow,filter] hover:translate-y-[-1px] hover:brightness-110"
          style={{
            border: "1px solid rgba(221,214,254,0.5)",
            color: "#1a0f2e",
            background: BUTTON_PRIMARY,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.2) inset, 0 12px 36px rgba(0,0,0,0.5), 0 0 32px rgba(124,58,237,0.45)",
          }}
        >
          Download as Excel
        </button>
      </div>
    </div>
  );
}
