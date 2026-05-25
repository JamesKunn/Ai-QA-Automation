"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const VERTICAL_GRADIENT =
  "linear-gradient(180deg, rgba(47,18,61,0.75) 46%, rgba(17,12,20,0.8) 92%, rgba(27,10,36,0.85) 100%)";

const SURFACE_GRADIENT =
  "linear-gradient(180deg, rgba(55,28,68,0.88) 0%, rgba(47,18,61,0.9) 46%, rgba(28,18,34,0.92) 100%)";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(data.message);
      setSelected([]);
      if (inputRef.current) inputRef.current.value = "";
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
            ? "border-[#dcc9eb]/80"
            : "border-[#c9b3d9]/45 hover:border-[#dcc9eb]/65"
        }`}
        style={{
          background: isDragging
            ? "linear-gradient(180deg, rgba(201,179,217,0.16) 0%, rgba(47,18,61,0.6) 46%, rgba(17,12,20,0.65) 100%)"
            : SURFACE_GRADIENT,
          boxShadow:
            "0 0 0 1px rgba(201,179,217,0.2) inset, 0 8px 28px rgba(0,0,0,0.4)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(201,179,217,0.1) 0%, transparent 46%, rgba(17,12,20,0.1) 100%), linear-gradient(rgba(201,179,217,0.06) 1px, transparent 1px)",
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
          className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-[#dcc9eb]"
          style={{
            background:
              "linear-gradient(180deg, rgba(201,179,217,0.22) 0%, rgba(47,18,61,0.3) 46%, rgba(27,10,36,0.35) 100%)",
            boxShadow:
              "0 0 0 1px rgba(201,179,217,0.22) inset, 0 0 28px rgba(47,18,61,0.35)",
          }}
        >
          <div className="relative">
            <UploadIcon />
          </div>
        </div>
        <p className="relative text-lg font-semibold text-[#ece6f0] drop-shadow-[0_0_14px_rgba(201,179,217,0.2)]">
          Drop files here or click to browse
        </p>

        <p className="relative mt-2 text-sm text-[#a89bb5]">
          CSV, PDF, and DOCX only — up to {MAX_FILE_SIZE_LABEL} each
        </p>
      </div>

      {selected.length > 0 && (
        <div
          className="mt-6 overflow-hidden rounded-2xl border backdrop-blur-xl"
          style={{
            borderColor: "rgba(201, 179, 217, 0.28)",
            background: SURFACE_GRADIENT,
            boxShadow: "0 0 0 1px rgba(201,179,217,0.12) inset",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "rgba(201, 179, 217, 0.12)" }}
          >
            <span className="text-sm font-medium text-[#c9b3d9]">
              {selected.length} file{selected.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-[#a89bb5] hover:text-[#dcc9eb]"
            >
              Clear all
            </button>
          </div>

          <ul className="divide-y divide-[rgba(201,179,217,0.1)]">
            {selected.map(({ id, file, error }) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#ece6f0]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#a89bb5]">
                    {formatFileSize(file.size)}
                    {error && (
                      <span className="ml-2 text-[#e8a8c8]">— {error}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#c9b3d9] hover:bg-[rgba(201,179,217,0.12)] hover:text-[#ece6f0]"
                  aria-label={`Remove ${file.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleUpload}
          disabled={status === "uploading" || validFiles.length === 0}
          className="inline-flex h-12 items-center justify-center rounded-3xl px-8 text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,filter] hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            border: "1px solid rgba(201,179,217,0.4)",
            color:
              validFiles.length > 0 && status !== "uploading"
                ? "#1b0a24"
                : "#dcc9eb",
            background:
              validFiles.length > 0 && status !== "uploading"
                ? "linear-gradient(180deg, rgba(220,201,235,0.95) 0%, rgba(201,179,217,0.9) 46%, rgba(168,145,190,0.95) 100%)"
                : VERTICAL_GRADIENT,
            boxShadow:
              status === "uploading"
                ? "0 0 0 1px rgba(201,179,217,0.2) inset, 0 10px 30px rgba(27,10,36,0.5)"
                : validFiles.length > 0
                  ? "0 0 0 1px rgba(220,201,235,0.35) inset, 0 14px 44px rgba(27,10,36,0.55), 0 0 28px rgba(201,179,217,0.2)"
                  : "0 0 0 1px rgba(201,179,217,0.12) inset, 0 14px 40px rgba(27,10,36,0.5), 0 0 22px rgba(47,18,61,0.35)",
          }}
        >
          {status === "uploading" ? "Uploading…" : "Upload files"}
        </button>

        <p className="text-xs text-[#a89bb5]">
          Allowed: {ACCEPTED_EXTENSIONS.join(", ")}
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm backdrop-blur-xl ${
            status === "success"
              ? "text-[#ece6f0] ring-1 ring-[#c9b3d9]/30"
              : "text-[#e8a8c8] ring-1 ring-[#c9b3d9]/15"
          }`}
          style={{
            background:
              status === "success"
                ? "linear-gradient(180deg, rgba(201,179,217,0.14) 0%, rgba(47,18,61,0.2) 46%, rgba(27,10,36,0.25) 100%)"
                : "linear-gradient(180deg, rgba(47,18,61,0.5) 46%, rgba(17,12,20,0.55) 92%, rgba(27,10,36,0.6) 100%)",
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
