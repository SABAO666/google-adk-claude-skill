# Claude Agent SDK Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `runner.ts` (which uses `@anthropic-ai/sdk` directly) with `@anthropic-ai/claude-agent-sdk`'s `query()` function to get native Skills support, while keeping ADK (Gemini 2.5 Flash) as the primary router.

**Architecture:** ADK `LlmAgent` (Gemini 2.5 Flash) routes user requests via `FunctionTool` → `runSkill()` in `runner.ts` → now calls Claude Agent SDK `query()` instead of `anthropic.messages.create()`. The SDK spawns a Claude Code subprocess that natively discovers and executes `SKILL.md` files from the `skills/` directory via `cwd` + `settingSources`.

**Tech Stack:** Next.js 16, `@anthropic-ai/claude-agent-sdk` v0.2.37, `@google/adk` v0.3, TypeScript, Vitest

---

## Background: Current vs Target Architecture

### Current Flow
```
User → ADK (Gemini) → FunctionTool "run_skill" → runner.ts → anthropic.messages.create()
                                                  ↓
                                            manually reads SKILL.md
                                            builds prompt manually
                                            calls Claude Messages API
```

### Target Flow
```
User → ADK (Gemini) → FunctionTool "run_skill" → runner.ts → SDK query()
                                                  ↓
                                            SDK spawns Claude Code subprocess
                                            Claude natively discovers SKILL.md via cwd
                                            returns SDKResultSuccess.result
```

### Key SDK API Reference

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// query() returns AsyncGenerator<SDKMessage, void> (extends Query interface)
const q = query({
  prompt: "Execute email_polisher skill on: ...",
  options: {
    cwd: "/path/to/skills/email_polisher",   // SKILL.md lives here
    settingSources: ["project"],              // loads .claude/settings.json + CLAUDE.md
    tools: [],                               // no built-in tools needed (skill execution only)
    permissionMode: "bypassPermissions",      // server-side, no human in the loop
    allowDangerouslySkipPermissions: true,
    maxTurns: 1,                             // single turn for skill execution
    persistSession: false,                   // ephemeral, no disk persistence
    systemPrompt: "You are executing a skill. Follow instructions exactly.",
    model: "claude-sonnet-4-5-20250929",
  },
});

// Iterate to get result
for await (const message of q) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);       // string — final text
    console.log(message.usage);        // { input_tokens, output_tokens, ... }
    console.log(message.total_cost_usd);
    console.log(message.duration_ms);
  }
}
```

### SDKResultSuccess shape
```typescript
{
  type: "result";
  subtype: "success";
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;           // <-- the final text output
  stop_reason: string | null;
  total_cost_usd: number;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; };
  modelUsage: Record<string, ModelUsage>;
  session_id: string;
}
```

---

## Task 1: Create `src/lib/skills/sdk-runner.ts`

New module that replaces the Anthropic SDK direct call with Claude Agent SDK's `query()`.

**Files:**
- Create: `src/lib/skills/sdk-runner.ts`
- Test: `src/lib/skills/__tests__/sdk-runner.test.ts`

### Step 1: Write the failing test

Create test file `src/lib/skills/__tests__/sdk-runner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the claude-agent-sdk
const mockQueryGenerator = {
  [Symbol.asyncIterator]: vi.fn(),
  next: vi.fn(),
  return: vi.fn(),
  throw: vi.fn(),
  interrupt: vi.fn(),
};

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn().mockReturnValue(mockQueryGenerator),
}));

import { runSkillWithSDK } from "../sdk-runner";
import path from "node:path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

describe("runSkillWithSDK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mock to return a success result
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
```

### Step 2: Run test to verify it fails

Run: `cd google-adk-claude-skill && npx vitest run src/lib/skills/__tests__/sdk-runner.test.ts`
Expected: FAIL with "Cannot find module '../sdk-runner'"

### Step 3: Write implementation

Create `src/lib/skills/sdk-runner.ts`:

```typescript
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

  for await (const message of q) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        resultText = message.result;
        inputTokens = message.usage?.input_tokens;
        outputTokens = message.usage?.output_tokens;
      } else {
        // error result
        throw new Error(
          `Skill execution failed: ${message.subtype} (${(message as { errors?: string[] }).errors?.join(", ") ?? "unknown error"})`,
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
    },
  };
}
```

### Step 4: Run test to verify it passes

Run: `cd google-adk-claude-skill && npx vitest run src/lib/skills/__tests__/sdk-runner.test.ts`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add src/lib/skills/sdk-runner.ts src/lib/skills/__tests__/sdk-runner.test.ts
git commit -m "feat: add sdk-runner using Claude Agent SDK query()"
```

---

## Task 2: Update `runSkillTool.ts` to use SDK runner

Switch the FunctionTool from old runner to new SDK runner.

**Files:**
- Modify: `src/lib/adk/tools/runSkillTool.ts`
- Test: `src/lib/adk/__tests__/runSkillTool.test.ts`

### Step 1: Update the test mock

Edit `src/lib/adk/__tests__/runSkillTool.test.ts`:

```typescript
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
```

### Step 2: Run test to verify it fails

Run: `cd google-adk-claude-skill && npx vitest run src/lib/adk/__tests__/runSkillTool.test.ts`
Expected: FAIL (still importing old runner)

### Step 3: Update implementation

Edit `src/lib/adk/tools/runSkillTool.ts` — change the import from `runner` to `sdk-runner`:

```typescript
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
      console.log(`[ADK] run_skill called → skillId="${skillId}" input="${userInput.slice(0, 80)}${userInput.length > 80 ? "..." : ""}"`);
      try {
        const result = await runSkillWithSDK({
          skillsDir,
          skillId,
          userInput,
        });
        console.log(`[ADK] run_skill success → skillId="${skillId}" latency=${result.telemetry?.latencyMs}ms tokens=${result.telemetry?.inputTokens}+${result.telemetry?.outputTokens}`);
        return {
          status: "success",
          text: result.text,
          skillId,
          telemetry: result.telemetry,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[ADK] run_skill error → skillId="${skillId}" error="${msg}"`);
        return {
          status: "error",
          error_message: msg,
        };
      }
    },
  });
}
```

### Step 4: Run test to verify it passes

Run: `cd google-adk-claude-skill && npx vitest run src/lib/adk/__tests__/runSkillTool.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/adk/tools/runSkillTool.ts src/lib/adk/__tests__/runSkillTool.test.ts
git commit -m "feat: switch runSkillTool to use Claude Agent SDK runner"
```

---

## Task 3: Update old `runner.test.ts` → rename to `sdk-runner.test.ts` reference check

The old `runner.test.ts` mocks `@anthropic-ai/sdk`. It should still work for backward compatibility but we should verify the new runner is used by the integration.

**Files:**
- Modify: `src/lib/skills/__tests__/runner.test.ts`

### Step 1: Update the old runner test to be an alias test

Since `runner.ts` is no longer called by the tool, update the test to verify the old runner still works independently (regression safety):

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Improved email text." }],
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

    expect(result.text).toBe("Improved email text.");
    expect(result.telemetry?.skillId).toBe("email_polisher");
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
```

### Step 2: Run all tests

Run: `cd google-adk-claude-skill && npx vitest run`
Expected: ALL PASS

### Step 3: Commit

```bash
git add src/lib/skills/__tests__/runner.test.ts
git commit -m "test: update runner test description for legacy clarity"
```

---

## Task 4: Update `types.ts` — add `costUsd` to telemetry

The SDK provides `total_cost_usd` which the old API didn't. Add it to the telemetry type.

**Files:**
- Modify: `src/lib/skills/types.ts`

### Step 1: Write the failing test (inline — type check is sufficient)

No separate test needed. The type change will be validated by TypeScript compilation.

### Step 2: Update the type

Edit `src/lib/skills/types.ts` — add `costUsd` to telemetry:

```typescript
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
```

### Step 3: Update sdk-runner.ts to include costUsd

In `src/lib/skills/sdk-runner.ts`, inside the result handler, add:

```typescript
// After: outputTokens = message.usage?.output_tokens;
// Add:
let costUsd: number | undefined;

// Inside the success branch:
costUsd = message.total_cost_usd;

// In the return, add to telemetry:
telemetry: {
  traceId,
  skillId: input.skillId,
  latencyMs,
  inputTokens,
  outputTokens,
  costUsd,
},
```

### Step 4: Run build to verify types

Run: `cd google-adk-claude-skill && npx tsc --noEmit`
Expected: No type errors

### Step 5: Commit

```bash
git add src/lib/skills/types.ts src/lib/skills/sdk-runner.ts
git commit -m "feat: add costUsd to skill telemetry from SDK"
```

---

## Task 5: Verify `SKILL.md` discovery works with SDK

The Claude Agent SDK discovers skills via filesystem. Ensure the skills directory has the correct structure.

**Files:**
- No file changes. Verification only.

### Step 1: Verify skill directory structure

```bash
# Each skill should have:
# skills/{skillId}/SKILL.md
ls -la skills/email_polisher/SKILL.md
ls -la skills/doc_summarizer/SKILL.md
ls -la skills/marketing-ideas/SKILL.md
```

Expected: All three SKILL.md files exist.

### Step 2: Verify SKILL.md format is SDK-compatible

The SDK expects SKILL.md with YAML frontmatter. Our existing format already matches:

```markdown
---
name: Email Polisher
description: ...
version: "1.0"
---

# Email Polisher
(instructions...)
```

This is already compatible. No changes needed.

### Step 3: Verify `.claude/` project settings don't interfere

Check if `google-adk-claude-skill/.claude/settings.json` exists. If it does, ensure it doesn't block Skills.

```bash
cat google-adk-claude-skill/.claude/settings.json 2>/dev/null || echo "No .claude/settings.json"
```

If no settings file exists, the SDK will use defaults, which is fine.

---

## Task 6: Build & Full Test

Run all tests and build to ensure nothing is broken.

**Files:**
- No changes.

### Step 1: Run all tests

Run: `cd google-adk-claude-skill && npx vitest run`
Expected: ALL PASS (5 test files, all green)

### Step 2: Run build

Run: `cd google-adk-claude-skill && npm run build`
Expected: Build succeeds

### Step 3: Manual integration test (optional)

1. `cd google-adk-claude-skill && npm run dev`
2. Open browser to `http://localhost:3000`
3. In the "Skill Agent" column, type: "このメールを丁寧にして: 明日よろしく"
4. Verify:
   - Gemini routes to `run_skill` with `skillId: "email_polisher"`
   - Console logs show `[SDK-Skill]` prefix (not old `[Skill]`)
   - Claude Agent SDK spawns, discovers SKILL.md, returns improved email
5. Check Gemini and Claude columns still work independently

### Step 4: Final commit

```bash
git add -A
git commit -m "chore: verify Claude Agent SDK integration works end-to-end"
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/skills/sdk-runner.ts` | **NEW** | New runner using `query()` from Claude Agent SDK |
| `src/lib/skills/__tests__/sdk-runner.test.ts` | **NEW** | Tests for SDK runner |
| `src/lib/adk/tools/runSkillTool.ts` | **MODIFY** | Import changed from `runner` → `sdk-runner` |
| `src/lib/adk/__tests__/runSkillTool.test.ts` | **MODIFY** | Mock changed to `sdk-runner` |
| `src/lib/skills/__tests__/runner.test.ts` | **MODIFY** | Updated description (legacy) |
| `src/lib/skills/types.ts` | **MODIFY** | Added `costUsd` to telemetry |

**Not changed (intentionally):**
- `src/lib/skills/runner.ts` — kept as-is for backward compatibility (can be removed later)
- `src/lib/adk/agent.ts` — no changes needed (Gemini router unchanged)
- `src/app/api/agent/route.ts` — no changes needed (ADK runner unchanged)
- `src/lib/skills/registry.ts` — still used for skill summary generation for ADK routing
- `src/lib/skills/loader.ts` — still used by registry for summary
- `src/lib/skills/policy.ts` — still used by both runners

## Important Notes

1. **Claude Agent SDK spawns a subprocess**: `query()` spawns a Claude Code child process. This means:
   - `ANTHROPIC_API_KEY` must be set in the environment
   - The subprocess has filesystem access to `cwd` (the skill directory)
   - `settingSources: ["project"]` tells it to load `.claude/settings.json` if present

2. **Latency consideration**: The SDK spawns a subprocess per call. For production, consider:
   - The V2 session API (`unstable_v2_prompt`) for persistent sessions (when stable)
   - Connection pooling at the process level

3. **Old runner.ts can be removed later**: Once SDK integration is verified in production, `runner.ts` and its direct `@anthropic-ai/sdk` dependency can be removed.
