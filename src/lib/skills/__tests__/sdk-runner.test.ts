import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the claude-agent-sdk with inline mock generator
vi.mock("@anthropic-ai/claude-agent-sdk", () => {
  const mockQueryGenerator = {
    [Symbol.asyncIterator]() { return this; },
    next: vi.fn(),
    return: vi.fn(),
    throw: vi.fn(),
    interrupt: vi.fn(),
  };

  return {
    query: vi.fn().mockReturnValue(mockQueryGenerator),
    __mockQueryGenerator: mockQueryGenerator, // Export for test access
  };
});

import { runSkillWithSDK } from "../sdk-runner";
import path from "node:path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

describe("runSkillWithSDK", () => {
  let mockQueryGenerator: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mock generator from the mocked module
    const mockedModule = await import("@anthropic-ai/claude-agent-sdk");
    mockQueryGenerator = (mockedModule as any).__mockQueryGenerator;

    // Setup mock to return a success result then done
    mockQueryGenerator.next
      .mockResolvedValueOnce({
        done: false,
        value: {
          type: "result",
          subtype: "success",
          result: "Improved email text here.",
          duration_ms: 1500,
          duration_api_ms: 1200,
          is_error: false,
          num_turns: 1,
          stop_reason: "end_turn",
          total_cost_usd: 0.003,
          usage: {
            input_tokens: 150,
            output_tokens: 80,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
          modelUsage: {},
          permission_denials: [],
          session_id: "test-session",
          uuid: "test-uuid",
        },
      })
      .mockResolvedValueOnce({ done: true, value: undefined });
  });

  it("should call query and return skill output", async () => {
    const result = await runSkillWithSDK({
      skillsDir: SKILLS_DIR,
      skillId: "email_polisher",
      userInput: "明日の会議よろしく",
    });

    expect(result.text).toBe("Improved email text here.");
    expect(result.telemetry?.skillId).toBe("email_polisher");
    expect(result.telemetry?.traceId).toBeDefined();
    expect(result.telemetry?.inputTokens).toBe(150);
    expect(result.telemetry?.outputTokens).toBe(80);
  });

  it("should reject invalid skill IDs", async () => {
    await expect(
      runSkillWithSDK({
        skillsDir: SKILLS_DIR,
        skillId: "../etc/passwd",
        userInput: "test",
      }),
    ).rejects.toThrow("Invalid skill ID");
  });

  it("should pass correct options to query()", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");

    await runSkillWithSDK({
      skillsDir: SKILLS_DIR,
      skillId: "email_polisher",
      userInput: "test input",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("test input"),
        options: expect.objectContaining({
          cwd: path.join(SKILLS_DIR, "email_polisher"),
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 1,
          persistSession: false,
          tools: [],
        }),
      }),
    );
  });
});
