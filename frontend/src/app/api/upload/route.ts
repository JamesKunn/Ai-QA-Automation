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

    return NextResponse.json({
      message: `Successfully uploaded ${saved.length} file(s).`,
      files: saved,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while uploading." },
      { status: 500 },
    );
  }
}
