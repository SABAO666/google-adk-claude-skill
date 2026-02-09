import { query } from "@anthropic-ai/claude-agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import { assertSkillAllowed } from "./policy";
import type { SkillRunOutput } from "./types";

const MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT =
  "You are executing a predefined skill. Follow the skill instructions in SKILL.md exactly. " +
  "Do not deviate from the instructions. Respond in the same language as the user input.";

export async function runSkillWithSDK(input: {
  skillsDir: string;
  skillId: string;
  userInput: string;
  context?: Record<string, unknown>;
}): Promise<SkillRunOutput> {
  const traceId = uuidv4();
  const start = Date.now();

  // 1. Permission check (path traversal prevention)
  assertSkillAllowed(input.skillId);

  const skillDir = path.join(input.skillsDir, input.skillId);
  console.log(`[SDK-Skill] Loading skill from: ${skillDir}`);

  // 2. Build prompt — SDK will discover SKILL.md natively via cwd
  const contextBlock = input.context
    ? `\n\nContext:\n${JSON.stringify(input.context, null, 2)}`
    : "";
  const prompt = `${input.userInput}${contextBlock}`;

  console.log(`[SDK-Skill] Calling Claude Agent SDK (${MODEL}) for skill "${input.skillId}"`);

  // 3. Call Claude Agent SDK
  const q = query({
    prompt,
    options: {
      cwd: skillDir,
      settingSources: ["project"],
      tools: [],
      model: MODEL,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 1,
      persistSession: false,
      systemPrompt: SYSTEM_PROMPT,
    },
  });

  // 4. Iterate through messages to find the result
  let resultText = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let costUsd: number | undefined;

  for await (const message of q) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        resultText = message.result;
        inputTokens = message.usage?.input_tokens;
        outputTokens = message.usage?.output_tokens;
        costUsd = message.total_cost_usd;
      } else {
        throw new Error(
          `Skill execution failed: ${message.subtype}`,
        );
      }
    }
  }

  const latencyMs = Date.now() - start;
  console.log(
    `[SDK-Skill] Done → skill="${input.skillId}" latency=${latencyMs}ms tokens=${inputTokens}+${outputTokens}`,
  );

  return {
    text: resultText,
    telemetry: {
      traceId,
      skillId: input.skillId,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd,
    },
  };
}
