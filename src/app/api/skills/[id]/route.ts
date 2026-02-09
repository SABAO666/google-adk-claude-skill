export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { SkillRegistry } from "@/lib/skills/registry";
import path from "node:path";

const skillsDir = path.resolve(process.cwd(), process.env.SKILLS_DIR ?? "skills");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const registry = new SkillRegistry(skillsDir);
    const skill = await registry.get(id);

    return Response.json({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      prompt: skill.prompt,
    });
  } catch {
    return Response.json({ error: "Skill not found" }, { status: 404 });
  }
}
