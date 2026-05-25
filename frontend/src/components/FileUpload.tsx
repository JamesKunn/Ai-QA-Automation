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
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <UploadIcon />
        </div>
        <p className="text-lg font-medium text-zinc-900">
          Drop files here or click to browse
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          CSV, PDF, and DOCX only — up to {MAX_FILE_SIZE_LABEL} each
        </p>
      </div>

      {selected.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <span className="text-sm font-medium text-zinc-700">
              {selected.length} file{selected.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              Clear all
            </button>
          </div>
          <ul className="divide-y divide-zinc-200">
            {selected.map(({ id, file, error }) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatFileSize(file.size)}
                    {error && (
                      <span className="ml-2 text-red-600">
                        — {error}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
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
          className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading…" : "Upload files"}
        </button>
        <p className="text-xs text-zinc-500">
          Allowed: {ACCEPTED_EXTENSIONS.join(", ")}
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            status === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
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
