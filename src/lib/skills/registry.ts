import { loadSkillManifest, listSkills } from "./loader";
import type { SkillManifest } from "./types";

export class SkillRegistry {
  private cache = new Map<string, SkillManifest>();
  private allLoaded = false;

  constructor(private skillsDir: string) {}

  async get(skillId: string): Promise<SkillManifest> {
    const cached = this.cache.get(skillId);
    if (cached) return cached;

    const skill = await loadSkillManifest(this.skillsDir, skillId);
    this.cache.set(skillId, skill);
    return skill;
  }

  async list(): Promise<SkillManifest[]> {
    if (this.allLoaded) return Array.from(this.cache.values());

    const skills = await listSkills(this.skillsDir);
    for (const s of skills) this.cache.set(s.id, s);
    this.allLoaded = true;
    return skills;
  }

  /** Clear cache to force reload from disk */
  invalidate(): void {
    this.cache.clear();
    this.allLoaded = false;
  }

  /** Summarize all skills for ADK routing */
  async getSummary(): Promise<string> {
    const skills = await this.list();
    return skills
      .map((s) => `- ${s.id}: ${s.description}`)
      .join("\n");
  }
}
