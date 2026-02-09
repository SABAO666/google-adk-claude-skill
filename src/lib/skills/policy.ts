/**
 * Validate skillId to prevent path traversal and ensure safe filesystem access.
 * The skills/ directory itself acts as the allowlist — only skills physically
 * present on disk can be loaded and executed.
 */
export function assertSkillAllowed(skillId: string): void {
  if (!skillId || typeof skillId !== "string") {
    throw new Error("Skill ID is required");
  }

  // Block path traversal attempts
  if (
    skillId.includes("..") ||
    skillId.includes("/") ||
    skillId.includes("\\") ||
    skillId.includes("\0")
  ) {
    throw new Error(`Invalid skill ID: ${skillId}`);
  }

  // Allow only safe characters: alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(skillId)) {
    throw new Error(`Invalid skill ID: ${skillId}`);
  }
}
