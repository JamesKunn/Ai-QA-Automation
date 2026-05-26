import { mkdir, access } from "fs/promises";
import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RESULTS_DIR = path.join(process.cwd(), "uploads", "results");

// Helper to check if file exists
async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// POST endpoint for n8n to send back processed files
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const originalName = formData.get("originalName");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided under key 'file'." },
        { status: 400 }
      );
    }

    if (!originalName || typeof originalName !== "string") {
      return NextResponse.json(
        { error: "No originalName string provided." },
        { status: 400 }
      );
    }

    await mkdir(RESULTS_DIR, { recursive: true });

    // Clean originalName to avoid directory traversal
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `processed-${safeName}`;
    const filePath = path.join(RESULTS_DIR, storedName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({
      message: "Processed file saved successfully.",
      filename: storedName,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to save processed file: ${error.message || error}` },
      { status: 500 }
    );
  }
}

// GET endpoint for frontend to poll for processed status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const originalName = searchParams.get("name");

    if (!originalName) {
      return NextResponse.json(
        { error: "Missing 'name' query parameter." },
        { status: 400 }
      );
    }

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `processed-${safeName}`;
    const filePath = path.join(RESULTS_DIR, storedName);

    const ready = await fileExists(filePath);

    if (ready) {
      return NextResponse.json({
        ready: true,
        downloadUrl: `/api/results/download?name=${encodeURIComponent(originalName)}`,
      });
    }

    return NextResponse.json({ ready: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error checking status: ${error.message || error}` },
      { status: 500 }
    );
  }
}
