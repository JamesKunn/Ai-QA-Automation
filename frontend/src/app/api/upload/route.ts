import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  isAllowedFile,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
} from "@/lib/allowed-file-types";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No files provided." },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const saved: { name: string; size: number }[] = [];
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

      const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const storedName = `${timestamp}-${safeName}`;
      const buffer = Buffer.from(await entry.arrayBuffer());
      const filePath = path.join(UPLOAD_DIR, storedName);

      await writeFile(filePath, buffer);
      saved.push({ name: entry.name, size: entry.size });
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { error: errors.join(" ") || "Upload failed." },
        { status: 400 },
      );
    }

    // Forward to n8n webhook if N8N_WEBHOOK_URL is set
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    let n8nStatus = "n8n integration inactive (N8N_WEBHOOK_URL is not set)";

    if (n8nUrl) {
      try {
        const n8nFormData = new FormData();
        
        // Retrieve original entries again to send exact files
        for (const entry of entries) {
          if (entry instanceof File && isAllowedFile(entry) && entry.size <= MAX_FILE_SIZE_BYTES) {
            // Re-create the file to ensure proper headers/naming
            n8nFormData.append("files", entry, entry.name);
          }
        }

        const response = await fetch(n8nUrl, {
          method: "POST",
          body: n8nFormData,
        });

        if (response.ok) {
          n8nStatus = `Success: Forwarded to n8n (${response.status})`;
        } else {
          n8nStatus = `Failed: n8n returned status ${response.status}`;
        }
      } catch (err: any) {
        n8nStatus = `Error: Failed to connect to n8n (${err.message || err})`;
      }
    }

    return NextResponse.json({
      message: `Successfully uploaded ${saved.length} file(s).`,
      files: saved,
      n8nStatus,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Something went wrong while uploading: ${error.message || error}` },
      { status: 500 },
    );
  }
}
