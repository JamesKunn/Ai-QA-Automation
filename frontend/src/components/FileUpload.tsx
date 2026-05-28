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

const SURFACE_GRADIENT =
  "linear-gradient(180deg, rgba(16,13,22,0.95) 0%, rgba(8,6,11,0.98) 55%, rgba(10,8,14,0.98) 100%)";

const BUTTON_PRIMARY =
  "linear-gradient(180deg, #ddd6fe 0%, #c4b5fd 40%, #a78bfa 100%)";

const BUTTON_DISABLED =
  "linear-gradient(180deg, rgba(16,13,22,0.95) 0%, rgba(8,6,11,0.98) 100%)";

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
        className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed px-8 py-14 text-center transition-[border-color,background-color] ${
          isDragging
            ? "border-[#c4b5fd]/70"
            : "border-[#a78bfa]/30 hover:border-[#c4b5fd]/50"
        }`}
        style={{
          background: isDragging
            ? "linear-gradient(180deg, rgba(167,139,250,0.1) 0%, rgba(12,9,18,0.95) 55%, rgba(6,5,9,0.98) 100%)"
            : SURFACE_GRADIENT,
          boxShadow:
            "0 0 0 1px rgba(167,139,250,0.12) inset, 0 8px 32px rgba(0,0,0,0.55)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(167,139,250,0.06) 0%, transparent 46%, rgba(4,3,6,0.2) 100%), linear-gradient(rgba(167,139,250,0.04) 1px, transparent 1px)",
            backgroundSize: "auto, 28px 28px",
            opacity: isDragging ? 0.95 : 0.75,
          }}
        />

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
        <div
          className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-[#c4b5fd]"
          style={{
            background:
              "linear-gradient(180deg, rgba(167,139,250,0.18) 0%, rgba(12,9,18,0.9) 55%, rgba(6,5,9,0.95) 100%)",
            boxShadow:
              "0 0 0 1px rgba(167,139,250,0.2) inset, 0 0 24px rgba(124,58,237,0.2)",
          }}
        >
          <div className="relative">
            <UploadIcon />
          </div>
        </div>
        <p className="relative text-lg font-semibold text-[#f0ecf4] drop-shadow-[0_0_12px_rgba(167,139,250,0.12)]">
          Drop files here or click to browse
        </p>

        <p className="relative mt-2 text-sm text-[#8f8798]">
          CSV, PDF, and DOCX only — up to {MAX_FILE_SIZE_LABEL} each
        </p>
      </div>

      {selected.length > 0 && (
        <div
          className="mt-6 overflow-hidden rounded-2xl border backdrop-blur-xl"
          style={{
            borderColor: "rgba(167, 139, 250, 0.22)",
            background: SURFACE_GRADIENT,
            boxShadow: "0 0 0 1px rgba(167,139,250,0.08) inset",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "rgba(167, 139, 250, 0.1)" }}
          >
            <span className="text-sm font-medium text-[#c4b5fd]">
              {selected.length} file{selected.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-[#8f8798] transition-colors hover:text-[#ddd6fe]"
            >
              Clear all
            </button>
          </div>

          <ul className="divide-y divide-[rgba(167,139,250,0.08)]">
            {selected.map(({ id, file, error }) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#f0ecf4]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#8f8798]">
                    {formatFileSize(file.size)}
                    {error && (
                      <span className="ml-2 text-[#e8a8c8]">— {error}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#c4b5fd] transition-colors hover:bg-[rgba(167,139,250,0.12)] hover:text-[#f0ecf4]"
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
          className="mb-2 block text-sm font-medium text-[#c4b5fd]"
        >
          Number of epics{" "}
          <span className="text-[#8f8798]">(optional)</span>
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
          className="w-full max-w-[12rem] rounded-xl border px-3 py-2 text-sm text-[#f0ecf4] outline-none transition-colors placeholder:text-[#8f8798] focus:border-[#c4b5fd]/50"
          style={{
            background: "rgba(8,6,11,0.6)",
            borderColor: "rgba(167,139,250,0.22)",
          }}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleUpload}
          disabled={status === "uploading" || validFiles.length === 0}
          className="inline-flex h-12 items-center justify-center rounded-3xl px-8 text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,filter] hover:translate-y-[-1px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          style={{
            border:
              validFiles.length > 0 && status !== "uploading"
                ? "1px solid rgba(221,214,254,0.5)"
                : "1px solid rgba(167,139,250,0.35)",
            color:
              validFiles.length > 0 && status !== "uploading"
                ? "#1a0f2e"
                : "#c4b5fd",
            background:
              validFiles.length > 0 && status !== "uploading"
                ? BUTTON_PRIMARY
                : BUTTON_DISABLED,
            boxShadow:
              status === "uploading"
                ? "0 0 0 1px rgba(167,139,250,0.25) inset, 0 8px 28px rgba(0,0,0,0.5), 0 0 20px rgba(124,58,237,0.25)"
                : validFiles.length > 0
                  ? "0 0 0 1px rgba(255,255,255,0.2) inset, 0 12px 36px rgba(0,0,0,0.5), 0 0 32px rgba(124,58,237,0.45)"
                  : "0 0 0 1px rgba(167,139,250,0.15) inset, 0 8px 28px rgba(0,0,0,0.45)",
          }}
        >
          {status === "uploading" ? "Uploading…" : "Upload files"}
        </button>

        <p className="text-xs text-[#8f8798]">
          Allowed: {ACCEPTED_EXTENSIONS.join(", ")}
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm backdrop-blur-xl ${
            status === "success"
              ? "text-[#f0ecf4] ring-1 ring-[#a78bfa]/35"
              : "text-[#f0a8c8] ring-1 ring-[#a78bfa]/15"
          }`}
          style={{
            background:
              status === "success"
                ? "linear-gradient(180deg, rgba(167,139,250,0.12) 0%, rgba(12,9,18,0.9) 55%, rgba(6,5,9,0.95) 100%)"
                : "linear-gradient(180deg, rgba(20,10,28,0.6) 0%, rgba(8,6,11,0.95) 100%)",
          }}
        >
          {message}
        </p>
      )}
    </div>
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
