export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, model } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || DEFAULT_MODEL;

    console.log(
      `[Chat] ← POST /api/chat (no skill) model="${selectedModel}" message="${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`,
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            stream: true,
            system:
              "You are a helpful assistant. Respond in the same language as the user input.",
            messages: [{ role: "user", content: message }],
          });

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const sseData = JSON.stringify({
                type: "text_delta",
                text: event.delta.text,
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          console.log(`[Chat] → SSE done`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          );
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          console.error(`[Chat] SSE error: ${msg}`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
