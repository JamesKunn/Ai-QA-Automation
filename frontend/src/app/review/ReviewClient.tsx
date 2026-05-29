"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

const SURFACE_GRADIENT = "#ffffff";
const BUTTON_PRIMARY = "#8b5cf6";

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
    return { dot: "#22c55e", text: "#15803d", bg: "rgba(34,197,94,0.1)" };
  if (["invalid", "error", "fail", "failed", "rejected"].includes(v))
    return { dot: "#ef4444", text: "#b91c1c", bg: "rgba(239,68,68,0.1)" };
  if (["pending", "processing", "in_progress", "review"].includes(v))
    return { dot: "#f59e0b", text: "#b45309", bg: "rgba(245,158,11,0.1)" };
  return { dot: "#8b5cf6", text: "#6d28d9", bg: "rgba(139,92,246,0.1)" };
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
      className="w-full resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-relaxed text-[#09090b] outline-none transition-colors focus:bg-[rgba(139,92,246,0.03)]"
      style={{
        boxShadow: props.edited
          ? "inset 2px 0 0 rgba(139,92,246,0.55)"
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

  // Hydrate from sessionStorage. Edits are stamped with the upload's
  // `uploadedAt`; we only restore them if that stamp matches the current
  // payload — otherwise stale edits from a previous upload are discarded.
  useEffect(() => {
    try {
      const rawPayload = sessionStorage.getItem(PAYLOAD_KEY);
      if (rawPayload) {
        const parsed = JSON.parse(rawPayload) as StoredPayload;
        setPayload(parsed);
        const original = extractRows(parsed.n8nData);
        setOriginalRows(original);

        let restored = original;
        const rawEdits = sessionStorage.getItem(EDITS_KEY);
        if (rawEdits) {
          try {
            const saved = JSON.parse(rawEdits) as {
              uploadedAt?: string;
              rows?: Row[];
            };
            if (
              saved.uploadedAt === parsed.uploadedAt &&
              Array.isArray(saved.rows)
            ) {
              restored = saved.rows;
            } else {
              sessionStorage.removeItem(EDITS_KEY); // stale — drop it
            }
          } catch {
            sessionStorage.removeItem(EDITS_KEY);
          }
        }
        setRows(restored);
      }
    } catch (err) {
      console.error("Failed to read review payload:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist edits on every change (skip the initial empty render).
  // Stamp with the upload's `uploadedAt` so they can't bind to another upload.
  useEffect(() => {
    if (!hydrated || !payload) return;
    try {
      sessionStorage.setItem(
        EDITS_KEY,
        JSON.stringify({ uploadedAt: payload.uploadedAt, rows }),
      );
    } catch {
      /* quota or disabled — silently ignore */
    }
  }, [rows, hydrated, payload]);

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
      <div className="rounded-lg border border-[#e4e4e7] bg-[#ffffff] px-6 py-12 text-center shadow-sm">
        <p className="text-base font-medium text-[#09090b]">
          No review data available.
        </p>
        <p className="mt-2 text-sm text-[#71717a]">
          {payload
            ? "The processing response didn't include any rows we could display."
            : "Upload a file first to see results here."}
        </p>
        {payload?.n8nData != null && (
          <details className="mx-auto mt-6 max-w-xl text-left text-xs text-[#71717a]">
            <summary className="cursor-pointer text-[#8b5cf6] hover:text-[#7c3aed]">
              Show raw response
            </summary>
            <pre className="mt-3 overflow-auto rounded-md bg-[#f4f4f5] p-3 text-[11px] leading-relaxed border border-[#e4e4e7] text-[#09090b]">
              {JSON.stringify(payload.n8nData, null, 2)}
            </pre>
          </details>
        )}
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold border border-[#8b5cf6] bg-[#8b5cf6] text-white transition-colors hover:bg-[#7c3aed]"
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
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#71717a]">
          <span className="truncate text-[#8b5cf6] font-medium">
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
              <span className="text-[#7c3aed] font-medium">
                {editedCount} unsaved edit{editedCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows…"
          className="w-full max-w-sm rounded-md border border-[#d4d4d8] bg-[#ffffff] px-3 py-2 text-sm text-[#09090b] outline-none transition-all placeholder:text-[#a1a1aa] focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#ffffff] shadow-sm">
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
              <tr className="border-b border-[#e4e4e7] bg-[#f4f4f5]">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">
                  #
                </th>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8b5cf6]"
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
                    className="group transition-colors hover:bg-[#f4f4f5]"
                    style={{
                      background: zebra
                        ? "rgba(244, 244, 245, 0.5)"
                        : "transparent",
                      borderBottom: "1px solid #e4e4e7",
                    }}
                  >
                    <td className="px-3 py-2 align-top text-xs text-[#71717a] tabular-nums">
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
                                className="w-0 flex-1 bg-transparent text-xs text-transparent outline-none focus:text-[#09090b]"
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
                        className="opacity-0 transition-opacity group-hover:opacity-100 rounded-md px-2 py-1 text-xs text-[#71717a] hover:bg-[#fee2e2] hover:text-[#ef4444]"
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
                    className="px-3 py-8 text-center text-sm text-[#71717a]"
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
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#e4e4e7] bg-[#ffffff] text-[#09090b] hover:bg-[#f4f4f5] px-4 text-sm font-medium transition-colors"
          >
            ← Back
          </Link>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#e4e4e7] bg-[#ffffff] text-[#09090b] hover:bg-[#f4f4f5] px-4 text-sm font-medium transition-colors"
          >
            + Add row
          </button>
          {editedCount > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#fca5a5] bg-[#ffffff] text-[#ef4444] hover:bg-[#fee2e2] px-4 text-sm font-medium transition-colors"
              title="Discard all edits and restore the original data"
            >
              Reset
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={downloadXlsx}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-5 text-sm font-medium transition-colors border border-[#8b5cf6]"
        >
          Download as Excel
        </button>
      </div>
    </div>
  );
}
