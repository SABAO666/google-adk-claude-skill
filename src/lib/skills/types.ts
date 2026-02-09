/** SKILL.md frontmatter metadata */
export type SkillManifest = {
  id: string;
  name: string;
  description: string;
  version?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  prompt: string;
};

/** Input to Skill Runner */
export type SkillRunInput = {
  skillId: string;
  userInput: string;
  context?: Record<string, unknown>;
};

/** Output from Skill Runner */
export type SkillRunOutput = {
  text: string;
  structured?: Record<string, unknown>;
  telemetry?: {
    traceId: string;
    skillId: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  };
};

/** SSE event types */
export type AgentStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "skill_start"; skillId: string }
  | { type: "skill_end"; skillId: string; latencyMs: number }
  | { type: "error"; message: string }
  | { type: "done" };
