export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { InMemoryRunner, stringifyContent, getFunctionCalls } from "@google/adk";
import { createAgent } from "@/lib/adk/agent";
import { SkillRegistry } from "@/lib/skills/registry";
import path from "node:path";

const skillsDir = path.resolve(process.cwd(), process.env.SKILLS_DIR ?? "skills");

// Cache runners per model
const runnerCache = new Map<string, ReturnType<typeof initRunner>>();

async function initRunner(model: string) {
  const registry = new SkillRegistry(skillsDir);
  const summary = await registry.getSummary();
  const agent = createAgent(skillsDir, summary, model);
  const runner = new InMemoryRunner({ agent, appName: "skill-app" });
  return runner;
}

function getRunner(model: string) {
  if (!runnerCache.has(model)) {
    runnerCache.set(model, initRunner(model));
  }
  return runnerCache.get(model)!;
}

/** Reset the singleton runner so the next request rebuilds it with fresh skills */
export function invalidateRunner(): void {
  runnerCache.clear();
  console.log("[API] Runner cache invalidated — will rebuild on next request");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, userId, model } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || "gemini-2.5-flash";

    console.log(`[API] ← POST /api/agent model="${selectedModel}" message="${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`);

    const runner = await getRunner(selectedModel);

    const sid = sessionId ?? crypto.randomUUID();
    const uid = userId ?? "anonymous";

    // Create session before running (required by ADK)
    await runner.sessionService.createSession({
      appName: "skill-app",
      userId: uid,
      sessionId: sid,
    });

    // SSE streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const events = runner.runAsync({
            userId: uid,
            sessionId: sid,
            newMessage: { role: "user", parts: [{ text: message }] },
          });

          for await (const event of events) {
            // Log ADK events for debugging
            const fnCalls = getFunctionCalls(event);
            if (fnCalls.length > 0) {
              for (const fc of fnCalls) {
                console.log(`[ADK] 🔧 Function call: ${fc.name}(${JSON.stringify(fc.args).slice(0, 120)})`);

                // Detect skill usage and send to frontend
                if (fc.name === "runSkillTool") {
                  const skillName = fc.args?.skill_name || fc.args?.skillName;
                  if (skillName) {
                    const skillEvent = JSON.stringify({
                      type: "skill_used",
                      skillName,
                      timestamp: Date.now(),
                    });
                    controller.enqueue(
                      encoder.encode(`data: ${skillEvent}\n\n`),
                    );
                    console.log(`[ADK] 🌟 Skill used: ${skillName}`);
                  }
                }
              }
            }

            // Extract text from event using ADK helper
            const text = stringifyContent(event);
            if (text) {
              const sseData = JSON.stringify({
                type: "text_delta",
                text,
              });
              controller.enqueue(
                encoder.encode(`data: ${sseData}\n\n`),
              );
            }
          }

          console.log(`[API] → SSE done`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          );
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          console.error(`[API] ❌ SSE error: ${msg}`);
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
