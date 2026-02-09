export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SkillRegistry } from "@/lib/skills/registry";
import path from "node:path";

const skillsDir = path.resolve(
  process.cwd(),
  process.env.SKILLS_DIR ?? "skills",
);

export async function GET() {
  try {
    const registry = new SkillRegistry(skillsDir);
    const skills = await registry.list();

    return NextResponse.json({
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
