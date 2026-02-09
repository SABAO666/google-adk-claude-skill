export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import {
  parseGitHubSource,
  previewGitHubSkill,
  importGitHubSkill,
  listGitHubSkills,
} from "@/lib/skills/github";
import { invalidateRunner } from "@/app/api/agent/route";

const skillsDir = path.resolve(
  process.cwd(),
  process.env.SKILLS_DIR ?? "skills",
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoUrl, skillPath, action } = body as {
      repoUrl?: string;
      skillPath?: string;
      action?: string;
    };

    if (!repoUrl) {
      return NextResponse.json(
        { error: "repoUrl is required" },
        { status: 400 },
      );
    }

    const token = process.env.GITHUB_TOKEN;

    // List available skills in a repo
    if (action === "list") {
      const skills = await listGitHubSkills(repoUrl, token);
      return NextResponse.json({ skills });
    }

    if (!skillPath && action !== "list") {
      return NextResponse.json(
        { error: "skillPath is required for preview/import" },
        { status: 400 },
      );
    }

    const source = parseGitHubSource(repoUrl, skillPath);

    // Preview skill without importing
    if (action === "preview") {
      const preview = await previewGitHubSkill(source, token);
      return NextResponse.json({ preview });
    }

    // Import skill
    const result = await importGitHubSkill(source, skillsDir, token);
    invalidateRunner();

    return NextResponse.json({
      success: true,
      skillId: result.skillId,
      filesWritten: result.filesWritten,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Import] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
