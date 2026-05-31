export type ReviewRow = Record<string, string | number | boolean | null>;

export type StoredPayload = {
  uploadedAt: string;
  files?: { name: string; size: number }[];
  n8nData: unknown;
};

export type ColumnMeta = {
  key: string;
  widthClass: string;
  widthPct: number;
};

const DEFAULT_ROW_KEYS = [
  "epics",
  "user_stories",
  "userStories",
  "stories",
  "data",
  "results",
  "items",
  "rows",
];

function formatArrayAsText(arr: unknown[]): string {
  if (
    arr.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    )
  ) {
    return arr.map((item, i) => `${i + 1}. ${String(item)}`).join("\n");
  }
  return JSON.stringify(arr);
}

export function extractRows(
  data: unknown,
  arrayKeys: string[] = DEFAULT_ROW_KEYS,
): ReviewRow[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.filter(
      (r): r is ReviewRow =>
        r !== null && typeof r === "object" && !Array.isArray(r),
    );
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of arrayKeys) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter(
          (r): r is ReviewRow =>
            r !== null && typeof r === "object" && !Array.isArray(r),
        );
      }
    }
    if (Object.keys(obj).length > 0 && !("raw" in obj)) {
      return [obj as ReviewRow];
    }
  }
  return [];
}

/** Flatten array fields (e.g. acceptance_criteria) into editable multiline text. */
export function normalizeRowsForDisplay(rows: ReviewRow[]): ReviewRow[] {
  return rows.map((row) => {
    const out: ReviewRow = { ...row };
    for (const [key, value] of Object.entries(out)) {
      if (Array.isArray(value)) {
        out[key] = formatArrayAsText(value);
      }
    }
    return out;
  });
}

export function extractPrdText(n8nData: unknown): string {
  if (n8nData && typeof n8nData === "object" && "prdText" in n8nData) {
    const v = (n8nData as Record<string, unknown>).prdText;
    if (typeof v === "string") return v;
  }
  return "";
}

export function deriveColumns(
  rows: ReviewRow[],
  preferredOrder?: string[],
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) seen.add(k);
  }
  if (!preferredOrder?.length) return Array.from(seen);
  const ordered = preferredOrder.filter((k) => seen.has(k));
  const rest = Array.from(seen).filter((k) => !ordered.includes(k));
  return [...ordered, ...rest];
}

export function planColumns(columns: string[]): ColumnMeta[] {
  if (columns.length === 0) return [];
  const weights = columns.map((c) => {
    const lower = c.toLowerCase();
    if (/^id$|_id$|^#$/.test(lower)) return 1;
    if (lower === "status" || lower === "state") return 1;
    if (lower === "title" || lower === "name" || lower === "label") return 2.5;
    if (
      lower.includes("description") ||
      lower.includes("summary") ||
      lower.includes("notes") ||
      lower.includes("criteria") ||
      lower.includes("user_story")
    )
      return 5;
    if (lower.includes("story_title")) return 2.5;
    return 2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return columns.map((key, i) => ({
    key,
    widthClass: "",
    widthPct: (weights[i] / total) * 100,
  }));
}

export function toCellString(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return formatArrayAsText(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function statusTone(value: string): { dot: string; text: string; bg: string } {
  const v = value.trim().toLowerCase();
  if (["valid", "success", "ok", "passed", "pass", "done"].includes(v))
    return { dot: "#22c55e", text: "#15803d", bg: "rgba(34,197,94,0.1)" };
  if (["invalid", "error", "fail", "failed", "rejected"].includes(v))
    return { dot: "#ef4444", text: "#b91c1c", bg: "rgba(239,68,68,0.1)" };
  if (["pending", "processing", "in_progress", "review"].includes(v))
    return { dot: "#f59e0b", text: "#b45309", bg: "rgba(245,158,11,0.1)" };
  return { dot: "#8b5cf6", text: "#6d28d9", bg: "rgba(139,92,246,0.1)" };
}
