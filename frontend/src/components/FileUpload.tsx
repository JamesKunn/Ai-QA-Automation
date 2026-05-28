"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  formatFileSize,
  isAllowedFile,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
} from "@/lib/allowed-file-types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

const NOTIFICATION_AUTO_CLOSE_MS = 5000;

const GENERATING_PHRASES = [
  "Generating",
  "Reading the document",
  "Identifying epics",
  "Grouping related features",
  "Structuring results",
  "Finalizing",
];

const PHRASE_INTERVAL_MS = 2200;

const SURFACE_GRADIENT = "#ffffff";

const BUTTON_PRIMARY = "#8b5cf6";
const BUTTON_PRIMARY_HOVER = "#7c3aed";

const BUTTON_DISABLED = "#f4f4f5";

type SelectedFile = {
  id: string;
  file: File;
  error?: string;
};

function validateFile(file: File): string | undefined {
  if (!isAllowedFile(file)) {
    return "Unsupported file type.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File exceeds ${MAX_FILE_SIZE_LABEL} limit.`;
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  return undefined;
}

export default function FileUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [epicCount, setEpicCount] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (status !== "uploading") {
      setPhraseIdx(0);
      return;
    }
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % GENERATING_PHRASES.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!message || status === "uploading" || status === "idle") return;

    const timer = setTimeout(() => {
      setMessage(null);
      setStatus("idle");
    }, NOTIFICATION_AUTO_CLOSE_MS);

    return () => clearTimeout(timer);
  }, [message, status]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      error: validateFile(file),
    }));

    setSelected((prev) => {
      const names = new Set(prev.map((p) => p.file.name));
      const merged = [...prev];
      for (const item of incoming) {
        if (!names.has(item.file.name)) {
          merged.push(item);
          names.add(item.file.name);
        }
      }
      return merged;
    });
    setStatus("idle");
    setMessage(null);
  }, []);

  const removeFile = (id: string) => {
    setSelected((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setSelected([]);
    setStatus("idle");
    setMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const validFiles = selected.filter((f) => !f.error);

  const handleUpload = async () => {
    if (validFiles.length === 0) {
      setStatus("error");
      setMessage("Add at least one valid file before uploading.");
      return;
    }

    setStatus("uploading");
    setMessage(null);

    const formData = new FormData();
    for (const { file } of validFiles) {
      formData.append("files", file);
    }
    if (epicCount.trim()) {
      formData.append("numberOfEpics", epicCount.trim());
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Upload failed.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Upload complete.");
      setSelected([]);
      if (inputRef.current) inputRef.current.value = "";

      // Always clear any prior review state first, so a previous upload's
      // output can never linger on /review when this upload has no data or
      // fails to persist. sessionStorage scopes per-tab so concurrent users
      // don't see each other.
      try {
        sessionStorage.removeItem("qa.review.edits");
        sessionStorage.removeItem("qa.review.payload");
      } catch {
        /* storage disabled — nothing to clear */
      }

      // Stash the n8n result for /review to consume, then navigate.
      if (data.n8nData) {
        try {
          sessionStorage.setItem(
            "qa.review.payload",
            JSON.stringify({
              uploadedAt: new Date().toISOString(),
              files: data.files ?? [],
              n8nData: data.n8nData,
            }),
          );
          router.push("/review");
        } catch (err) {
          console.error("Failed to stash review payload:", err);
          setStatus("error");
          setMessage(
            "Upload succeeded, but the result was too large to open in the review page.",
          );
        }
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group relative cursor-pointer overflow-hidden rounded-lg border border-dashed px-8 py-12 text-center transition-colors ${
          isDragging
            ? "border-[#8b5cf6] bg-[#f4f4f5]"
            : "border-[#d4d4d8] bg-[#ffffff] hover:border-[#a1a1aa] hover:bg-[#fafafa]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
          }}
        />
        <div className="relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-[#e4e4e7] bg-[#f4f4f5] text-[#8b5cf6]">
          <UploadIcon />
        </div>
        <p className="text-sm font-medium text-[#09090b]">
          Drag & drop files here, or click to browse
        </p>

        <p className="mt-1.5 text-xs text-[#71717a]">
          PDF only — up to {MAX_FILE_SIZE_LABEL} each
        </p>
      </div>

      {selected.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#ffffff]">
          <div className="flex items-center justify-between border-b border-[#e4e4e7] px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8b5cf6]">
              {selected.length} file{selected.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-[#71717a] transition-colors hover:text-[#7c3aed]"
            >
              Clear all
            </button>
          </div>

          <ul className="divide-y divide-[#e4e4e7]">
            {selected.map(({ id, file, error }) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#09090b]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#71717a]">
                    {formatFileSize(file.size)}
                    {error && (
                      <span className="ml-2 text-[#ef4444]">— {error}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  className="shrink-0 rounded-md border border-[#e4e4e7] bg-[#ffffff] px-2.5 py-1 text-xs text-[#ef4444] transition-colors hover:bg-[#fee2e2] hover:border-[#fca5a5] hover:text-[#ef4444]"
                  aria-label={`Remove ${file.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <label
          htmlFor="epic-count"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#71717a]"
        >
          Number of epics <span className="lowercase text-[#a1a1aa]">(optional)</span>
        </label>
        <input
          id="epic-count"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={epicCount}
          onChange={(e) => setEpicCount(e.target.value)}
          placeholder="e.g. 5"
          className="w-full max-w-[12rem] rounded-md border border-[#d4d4d8] bg-[#ffffff] px-3 py-2 text-sm text-[#09090b] outline-none transition-all placeholder:text-[#a1a1aa] focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleUpload}
          disabled={status === "uploading" || validFiles.length === 0}
          className={`inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${
            validFiles.length > 0 && status !== "uploading"
              ? "bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-medium border border-[#8b5cf6]"
              : "bg-[#f4f4f5] border border-[#e4e4e7] text-[#a1a1aa]"
          }`}
        >
          {status === "uploading" ? "Generating…" : "Upload files"}
        </button>

        <p className="text-xs text-[#71717a]">
          Allowed: {ACCEPTED_EXTENSIONS.join(", ")}
        </p>
      </div>

      {status === "uploading" && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-md border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm text-[#09090b]"
        >
          <Spinner />
          <div className="min-w-0">
            <span className="qa-shimmer-text text-sm font-medium">
              {GENERATING_PHRASES[phraseIdx]}…
            </span>
            <p className="mt-0.5 text-xs text-[#71717a]">
              This may take a moment — please don’t close this tab.
            </p>
          </div>
        </div>
      )}

      {message && status !== "uploading" && (
        <p
          role="status"
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            status === "success"
              ? "border-[#e4e4e7] bg-[#fafafa] text-[#09090b]"
              : "border-[#fee2e2] bg-[#fef2f2] text-[#ef4444]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 shrink-0 animate-spin text-[#8b5cf6]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
