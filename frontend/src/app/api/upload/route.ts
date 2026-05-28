import { NextResponse } from "next/server";
import {
  isAllowedFile,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
} from "@/lib/allowed-file-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");
    const numberOfEpics = formData.get("numberOfEpics");

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No files provided." },
        { status: 400 },
      );
    }

    const accepted: File[] = [];
    const errors: string[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File) || entry.size === 0) {
        errors.push("One or more entries were not valid files.");
        continue;
      }

      if (!isAllowedFile(entry)) {
        errors.push(`"${entry.name}" has an unsupported file type.`);
        continue;
      }

      if (entry.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${entry.name}" exceeds the ${MAX_FILE_SIZE_LABEL} size limit.`);
        continue;
      }

      accepted.push(entry);
    }

    if (accepted.length === 0) {
      return NextResponse.json(
        { error: errors.join(" ") || "Upload failed." },
        { status: 400 },
      );
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    let n8nStatus = "n8n integration inactive (N8N_WEBHOOK_URL is not set)";
    let n8nData: unknown = null;

    if (n8nUrl) {
      try {
        const n8nFormData = new FormData();
        for (const file of accepted) {
          n8nFormData.append("files", file, file.name);
        }
        if (typeof numberOfEpics === "string" && numberOfEpics.trim()) {
          n8nFormData.append("numberOfEpics", numberOfEpics.trim());
        }

        const response = await fetch(n8nUrl, {
          method: "POST",
          body: n8nFormData,
        });

        // Try to parse JSON response from n8n's "Respond to Webhook" node.
        // Fall back to text so we never throw on unexpected payloads.
        const responseContentType = response.headers.get("content-type") ?? "";
        if (responseContentType.includes("application/json")) {
          n8nData = await response.json();
        } else {
          const text = await response.text();
          n8nData = text ? { raw: text } : null;
        }

        n8nStatus = response.ok
          ? `Success: Forwarded to n8n (${response.status})`
          : `Failed: n8n returned status ${response.status}`;
      } catch (err: any) {
        n8nStatus = `Error: Failed to connect to n8n (${err.message || err})`;
      }
    }

    return NextResponse.json({
      message: `Successfully uploaded ${accepted.length} file(s).`,
      files: accepted.map((f) => ({ name: f.name, size: f.size })),
      n8nStatus,
      n8nData,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Something went wrong while uploading: ${error.message || error}` },
      { status: 500 },
    );
  }
}
