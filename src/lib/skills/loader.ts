import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { SkillManifest } from "./types";

async function loadReferences(skillDir: string): Promise<string> {
  const refDir = path.join(skillDir, "references");
  try {
    const entries = await fs.readdir(refDir);
    const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
    if (mdFiles.length === 0) return "";

    const contents: string[] = [];
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(refDir, file), "utf-8");
      contents.push(`## Reference: ${file}\n\n${content}`);
    }
    return "\n\n---\n\n# References\n\n" + contents.join("\n\n---\n\n");
  } catch {
    return "";
  }
}

export async function loadSkillManifest(
  skillsDir: string,
  skillId: string,
): Promise<SkillManifest> {
  const skillDir = path.join(skillsDir, skillId);
  const skillPath = path.join(skillDir, "SKILL.md");
  const raw = await fs.readFile(skillPath, "utf-8");
  const { data, content } = matter(raw);
  const references = await loadReferences(skillDir);

  return {
    id: skillId,
    name: (data.name as string) ?? skillId,
    description: (data.description as string) ?? "",
    version: data.version as string | undefined,
    inputSchema: data.inputSchema as Record<string, unknown> | undefined,
    outputSchema: data.outputSchema as Record<string, unknown> | undefined,
    prompt: content.trim() + references,
  };
}

export async function listSkills(skillsDir: string): Promise<SkillManifest[]> {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const skills: SkillManifest[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const skill = await loadSkillManifest(skillsDir, entry.name);
      skills.push(skill);
    } catch {
      // Skip directories without SKILL.md
    }
  }

  return skills;
}
