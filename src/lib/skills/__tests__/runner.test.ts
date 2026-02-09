import { describe, it, expect, vi } from "vitest";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "改善後のメール本文です。" }],
          usage: { input_tokens: 100, output_tokens: 50 },
          stop_reason: "end_turn",
        }),
      },
    })),
  };
});

import { runSkill } from "../runner";
import path from "node:path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

describe("runSkill (legacy — Anthropic SDK direct)", () => {
  it("should still work as standalone function", async () => {
    const result = await runSkill({
      skillsDir: SKILLS_DIR,
      skillId: "email_polisher",
      userInput: "明日の会議よろしく",
    });

    expect(result.text).toBe("改善後のメール本文です。");
    expect(result.telemetry?.skillId).toBe("email_polisher");
    expect(result.telemetry?.traceId).toBeDefined();
  });

  it("should reject invalid skill IDs", async () => {
    await expect(
      runSkill({
        skillsDir: SKILLS_DIR,
        skillId: "../etc/passwd",
        userInput: "test",
      }),
    ).rejects.toThrow("Invalid skill ID");
  });
});
