import { describe, it, expect, beforeEach } from "vitest";
import { SkillRegistry } from "../registry";
import path from "node:path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry(SKILLS_DIR);
  });

  it("スキルを取得できること", async () => {
    const skill = await registry.get("email_polisher");
    expect(skill.id).toBe("email_polisher");
    expect(skill.name).toBe("Email Polisher");
  });

  it("2回目はキャッシュから取得されること", async () => {
    const s1 = await registry.get("email_polisher");
    const s2 = await registry.get("email_polisher");
    expect(s1).toBe(s2); // Same object reference
  });

  it("全スキル一覧を取得できること", async () => {
    const all = await registry.list();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it("スキル説明のサマリーを取得できること", async () => {
    const summary = await registry.getSummary();
    expect(summary).toContain("email_polisher");
    expect(summary).toContain("doc_summarizer");
  });
});
