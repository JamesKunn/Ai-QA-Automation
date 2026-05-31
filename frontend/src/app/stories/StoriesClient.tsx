"use client";

import ReviewTableClient from "@/components/ReviewTableClient";

const STORIES_REVIEW_CONFIG = {
  payloadKey: "qa.stories.payload",
  editsKey: "qa.stories.edits",
  backHref: "/review",
  backLabel: "Back to epics",
  downloadFilePrefix: "qa-user-stories",
  sheetName: "User Stories",
  emptyTitle: "No user stories available.",
  emptyNoPayload: "Generate user stories from the epics review page first.",
  emptyNoRows:
    "The generation response didn't include any rows we could display.",
  rowArrayKeys: [
    "user_stories",
    "userStories",
    "stories",
    "data",
    "results",
    "items",
    "rows",
  ],
  columnOrder: [
    "epic_link",
    "story_title",
    "user_story",
    "acceptance_criteria",
    "status",
    "timestamp",
    "workflow",
  ],
};

export default function StoriesClient() {
  return <ReviewTableClient config={STORIES_REVIEW_CONFIG} />;
}
