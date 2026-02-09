export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const DEFAULT_MODEL = "gemini-2.5-flash";

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
      `[Gemini] <- POST /api/gemini model="${selectedModel}" message="${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`,
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await ai.models.generateContentStream({
            model: selectedModel,
            contents: message,
            config: {
              systemInstruction:
                "You are a helpful assistant. Respond in the same language as the user input.",
            },
          });

          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              const sseData = JSON.stringify({
                type: "text_delta",
                text,
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          console.log(`[Gemini] -> SSE done`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          );
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          console.error(`[Gemini] SSE error: ${msg}`);
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
