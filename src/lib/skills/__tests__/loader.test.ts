import { describe, it, expect } from "vitest";
import { loadSkillManifest, listSkills } from "../loader";
import path from "node:path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

describe("loadSkillManifest", () => {
  it("email_polisher のSKILL.mdを読み込めること", async () => {
    const skill = await loadSkillManifest(SKILLS_DIR, "email_polisher");
    expect(skill.id).toBe("email_polisher");
    expect(skill.name).toBe("Email Polisher");
    expect(skill.description).toContain("ビジネスメール");
    expect(skill.prompt).toContain("# Email Polisher");
    expect(skill.version).toBe("1.0");
  });

  it("存在しないスキルでエラーになること", async () => {
    await expect(loadSkillManifest(SKILLS_DIR, "nonexistent")).rejects.toThrow();
  });
});

describe("listSkills", () => {
  it("全スキル一覧を取得できること", async () => {
    const skills = await listSkills(SKILLS_DIR);
    expect(skills.length).toBeGreaterThanOrEqual(2);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("email_polisher");
    expect(ids).toContain("doc_summarizer");
  });
});
