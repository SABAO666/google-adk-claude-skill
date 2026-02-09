import { describe, it, expect, vi } from "vitest";

// Mock the NEW sdk-runner module
vi.mock("../../skills/sdk-runner", () => ({
  runSkillWithSDK: vi.fn().mockResolvedValue({
    text: "Mocked SDK skill output",
    telemetry: { traceId: "test", skillId: "email_polisher", latencyMs: 100 },
  }),
}));

import { createRunSkillTool } from "../tools/runSkillTool";

describe("createRunSkillTool", () => {
  it("FunctionTool instance should be returned", () => {
    const tool = createRunSkillTool("skills", "- email_polisher: test skill");
    expect(tool).toBeDefined();
    expect(tool.name).toBe("run_skill");
  });
});
