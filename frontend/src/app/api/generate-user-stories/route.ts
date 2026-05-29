import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  prdText?: unknown;
  epics?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const epics = body.epics;

    if (!Array.isArray(epics) || epics.length === 0) {
      return NextResponse.json(
        { error: "No epics provided to generate user stories from." },
        { status: 400 },
      );
    }

    const prdText = typeof body.prdText === "string" ? body.prdText : "";

    const n8nUrl = process.env.N8N_USER_STORIES_WEBHOOK_URL;
    let n8nStatus =
      "n8n integration inactive (N8N_USER_STORIES_WEBHOOK_URL is not set)";
    let n8nData: unknown = null;

    if (n8nUrl) {
      try {
        const response = await fetch(n8nUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prdText, epics }),
        });

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
      message: `Sent ${epics.length} epic(s) for user story generation.`,
      n8nStatus,
      n8nData,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: `Something went wrong while generating user stories: ${error.message || error}`,
      },
      { status: 500 },
    );
  }
}
