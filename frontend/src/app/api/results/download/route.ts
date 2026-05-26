import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RESULTS_DIR = path.join(process.cwd(), "uploads", "results");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return new Response("Missing 'name' parameter", { status: 400 });
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `processed-${safeName}`;
    const filePath = path.join(RESULTS_DIR, storedName);

    try {
      const fileBuffer = await readFile(filePath);
      const fileStat = await stat(filePath);

      // Determine content type simple fallback
      let contentType = "application/octet-stream";
      if (storedName.endsWith(".pdf")) contentType = "application/pdf";
      else if (storedName.endsWith(".csv")) contentType = "text/csv";
      else if (storedName.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${storedName}"`,
          "Content-Length": fileStat.size.toString(),
        },
      });
    } catch {
      return new Response("File not found or not ready yet.", { status: 404 });
    }
  } catch (error: any) {
    return new Response(`Error downloading file: ${error.message || error}`, { status: 500 });
  }
}
