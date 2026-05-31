"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReviewTableClient from "@/components/ReviewTableClient";
import { extractPrdText, type ReviewRow, type StoredPayload } from "@/lib/review-table-utils";

const EPIC_REVIEW_CONFIG = {
  payloadKey: "qa.review.payload",
  editsKey: "qa.review.edits",
  backHref: "/",
  backLabel: "Back to upload",
  downloadFilePrefix: "qa-epics",
  sheetName: "Epics",
  emptyTitle: "No review data available.",
  emptyNoPayload: "Upload a file first to see results here.",
  emptyNoRows: "The processing response didn't include any rows we could display.",
};

const STORIES_PAYLOAD_KEY = "qa.stories.payload";
const STORIES_EDITS_KEY = "qa.stories.edits";

type StoriesStatus = "idle" | "generating" | "error";

export default function ReviewClient() {
  const router = useRouter();
  const [storiesStatus, setStoriesStatus] = useState<StoriesStatus>("idle");
  const [storiesMessage, setStoriesMessage] = useState<string | null>(null);

  async function generateUserStories(
    payload: StoredPayload,
    rows: ReviewRow[],
  ) {
    if (rows.length === 0) return;
    setStoriesStatus("generating");
    setStoriesMessage(null);

    try {
      const res = await fetch("/api/generate-user-stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prdText: extractPrdText(payload.n8nData),
          epics: rows,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStoriesStatus("error");
        setStoriesMessage(data.error ?? "Failed to generate user stories.");
        return;
      }

      if (data.n8nData) {
        try {
          sessionStorage.removeItem(STORIES_EDITS_KEY);
          sessionStorage.removeItem(STORIES_PAYLOAD_KEY);
          sessionStorage.setItem(
            STORIES_PAYLOAD_KEY,
            JSON.stringify({
              uploadedAt: payload.uploadedAt,
              files: payload.files,
              n8nData: data.n8nData,
            }),
          );
          router.push("/stories");
          return;
        } catch (err) {
          console.error("Failed to stash stories payload:", err);
          setStoriesStatus("error");
          setStoriesMessage(
            "Generation succeeded, but the result was too large to open in the stories page.",
          );
          return;
        }
      }

      setStoriesStatus("idle");
      setStoriesMessage(data.n8nStatus ?? data.message ?? "Done.");
    } catch {
      setStoriesStatus("error");
      setStoriesMessage("Network error. Please try again.");
    }
  }

  return (
    <>
      <ReviewTableClient
        config={EPIC_REVIEW_CONFIG}
        renderExtraActions={({ payload, rows }) => (
          <button
            type="button"
            onClick={() => generateUserStories(payload, rows)}
            disabled={storiesStatus === "generating"}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#8b5cf6] bg-[#ffffff] text-[#8b5cf6] hover:bg-[#f4f4f5] px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            {storiesStatus === "generating"
              ? "Generating…"
              : "Generate User Stories"}
          </button>
        )}
      />

      {storiesMessage && (
        <p
          role="status"
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            storiesStatus === "error"
              ? "border-[#fee2e2] bg-[#fef2f2] text-[#ef4444]"
              : "border-[#e4e4e7] bg-[#fafafa] text-[#09090b]"
          }`}
        >
          {storiesMessage}
        </p>
      )}
    </>
  );
}
