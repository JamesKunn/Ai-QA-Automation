import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Receives processed results from n8n. For now this just accepts the payload,
// logs it (visible in Vercel function logs), and echoes it back so n8n's HTTP
// node sees a 200. No persistence — browser delivery comes in a later step.
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: unknown;

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = await request.text();
    }

    console.log("[/api/results] received from n8n:", payload);

    return NextResponse.json({
      ok: true,
      receivedAt: new Date().toISOString(),
      echo: payload,
    });
  } catch (error: any) {
    console.error("[/api/results] error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "POST processed results here as JSON.",
  });
}
