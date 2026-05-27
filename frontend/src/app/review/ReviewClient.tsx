"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

const SURFACE_GRADIENT =
  "linear-gradient(180deg, rgba(16,13,22,0.95) 0%, rgba(8,6,11,0.98) 55%, rgba(10,8,14,0.98) 100%)";
const BUTTON_PRIMARY =
  "linear-gradient(180deg, #ddd6fe 0%, #c4b5fd 40%, #a78bfa 100%)";

type Row = Record<string, string | number | boolean | null>;

type StoredPayload = {
  uploadedAt: string;
  files?: { name: string; size: number }[];
  n8nData: unknown;
};

/**
 * The n8n "Respond to Webhook" node can return data in several shapes:
 *  - an array of row objects:                [{...}, {...}]
 *  - { epics: [...] } / { data: [...] } /    { results: [...] } / { items: [...] }
 *  - a single object (treated as one row):   { ... }
 *  - { raw: "..." } when n8n returned text   we don't know how to parse
 *
 * We probe for the first array-of-objects we can find and use that.
 */
function extractRows(data: unknown): Row[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.filter((r): r is Row => r !== null && typeof r === "object" && !Array.isArray(r));
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["epics", "data", "results", "items", "rows"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter(
          (r): r is Row => r !== null && typeof r === "object" && !Array.isArray(r),
        );
      }
    }
    // Single object → single row
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

function toCellString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function ReviewClient() {
  const [payload, setPayload] = useState<StoredPayload | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("qa.review.payload");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPayload;
        setPayload(parsed);
        setRows(extractRows(parsed.n8nData));
      }
    } catch (err) {
      console.error("Failed to read review payload:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  const columns = useMemo(() => deriveColumns(rows), [rows]);

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

  function downloadXlsx() {
    const sheetData = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) out[c] = row[c] ?? "";
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(sheetData, { header: columns });
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

  return (
    <div>
      {payload.files && payload.files.length > 0 && (
        <p className="mb-4 text-xs text-[#8f8798]">
          Source: {payload.files.map((f) => f.name).join(", ")}
          {" · "}
          {new Date(payload.uploadedAt).toLocaleString()}
          {" · "}
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </p>
      )}

      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "rgba(167, 139, 250, 0.22)",
          background: SURFACE_GRADIENT,
          boxShadow: "0 0 0 1px rgba(167,139,250,0.08) inset",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(167,139,250,0.18)" }}>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#c4b5fd]"
                  >
                    {c}
                  </th>
                ))}
                <th className="w-10 px-3 py-2.5" aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="transition-colors hover:bg-[rgba(167,139,250,0.04)]"
                  style={{ borderBottom: "1px solid rgba(167,139,250,0.08)" }}
                >
                  {columns.map((c) => (
                    <td key={c} className="align-top">
                      <textarea
                        value={toCellString(row[c])}
                        onChange={(e) => updateCell(ri, c, e.target.value)}
                        rows={1}
                        className="w-full resize-y bg-transparent px-3 py-2 text-sm text-[#f0ecf4] outline-none focus:bg-[rgba(167,139,250,0.06)]"
                        style={{ minHeight: "2.25rem" }}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      className="rounded-md px-2 py-1 text-xs text-[#8f8798] transition-colors hover:bg-[rgba(232,168,200,0.08)] hover:text-[#f0a8c8]"
                      aria-label={`Remove row ${ri + 1}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-semibold text-[#c4b5fd] transition-colors hover:text-[#ddd6fe]"
            style={{ borderColor: "rgba(167,139,250,0.35)" }}
          >
            ← Back
          </Link>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-semibold text-[#c4b5fd] transition-colors hover:text-[#ddd6fe]"
            style={{ borderColor: "rgba(167,139,250,0.35)" }}
          >
            + Add row
          </button>
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
