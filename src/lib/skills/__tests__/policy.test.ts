import { describe, it, expect } from "vitest";
import { assertSkillAllowed } from "../policy";

describe("assertSkillAllowed", () => {
  it("valid skill IDs are allowed", () => {
    expect(() => assertSkillAllowed("email_polisher")).not.toThrow();
    expect(() => assertSkillAllowed("doc_summarizer")).not.toThrow();
    expect(() => assertSkillAllowed("marketing-ideas")).not.toThrow();
    expect(() => assertSkillAllowed("CopyWriting123")).not.toThrow();
  });

  it("path traversal attempts are blocked", () => {
    expect(() => assertSkillAllowed("../etc/passwd")).toThrow("Invalid skill ID");
    expect(() => assertSkillAllowed("foo/bar")).toThrow("Invalid skill ID");
    expect(() => assertSkillAllowed("foo\\bar")).toThrow("Invalid skill ID");
    expect(() => assertSkillAllowed("skill\0inject")).toThrow("Invalid skill ID");
  });

  it("empty or non-string values are blocked", () => {
    expect(() => assertSkillAllowed("")).toThrow("Skill ID is required");
  });

  it("special characters are blocked", () => {
    expect(() => assertSkillAllowed("skill name")).toThrow("Invalid skill ID");
    expect(() => assertSkillAllowed("skill@name")).toThrow("Invalid skill ID");
    expect(() => assertSkillAllowed("skill.name")).toThrow("Invalid skill ID");
  });
});
