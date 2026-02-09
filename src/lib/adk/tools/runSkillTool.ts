import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { runSkillWithSDK } from "../../skills/sdk-runner";

export function createRunSkillTool(skillsDir: string, skillsSummary: string) {
  return new FunctionTool({
    name: "run_skill",
    description:
      "Execute a predefined skill by its ID. Available skills:\n" +
      skillsSummary +
      "\nChoose the most appropriate skill based on the user's request.",
    parameters: z.object({
      skillId: z
        .string()
        .describe("The skill ID to execute (e.g. email_polisher, doc_summarizer)"),
      userInput: z
        .string()
        .describe("The user's input text to process with the skill"),
    }),
    execute: async ({ skillId, userInput }: { skillId: string; userInput: string }) => {
      console.log(`[ADK] 🎯 run_skill called → skillId="${skillId}" input="${userInput.slice(0, 80)}${userInput.length > 80 ? "..." : ""}"`);
      try {
        const result = await runSkillWithSDK({
          skillsDir,
          skillId,
          userInput,
        });
        console.log(`[ADK] ✅ run_skill success → skillId="${skillId}" latency=${result.telemetry?.latencyMs}ms tokens=${result.telemetry?.inputTokens}+${result.telemetry?.outputTokens}`);
        return {
          status: "success",
          text: result.text,
          skillId,
          telemetry: result.telemetry,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[ADK] ❌ run_skill error → skillId="${skillId}" error="${msg}"`);
        return {
          status: "error",
          error_message: msg,
        };
      }
    },
  });
}
