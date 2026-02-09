import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type GitHubSkillSource = {
  owner: string;
  repo: string;
  branch: string;
  skillPath: string;
  skillId: string;
};

export type SkillPreview = {
  name: string;
  description: string;
  version?: string;
  promptPreview: string;
  hasReferences: boolean;
  referenceFiles: string[];
};

export type ImportResult = {
  skillId: string;
  filesWritten: string[];
};

type GitHubContentItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
};

function authHeaders(token?: string): Record<string, string> {
  const t = token ?? process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "skill-agent",
  };
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

async function ghFetch<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function ghFetchRaw(url: string, token?: string): Promise<string> {
  const t = token ?? process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { "User-Agent": "skill-agent" };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub raw fetch ${res.status}: ${url}`);
  }
  return res.text();
}

/**
 * Parse a GitHub repo URL and optional skill path into structured source info.
 *
 * Supports:
 *   - repoUrl: "https://github.com/owner/repo"  + skillPath: "copywriting"
 *   - repoUrl: "https://github.com/owner/repo/tree/main/skills/copywriting"
 */
export function parseGitHubSource(
  repoUrl: string,
  skillPath?: string,
): GitHubSkillSource {
  const url = new URL(repoUrl.replace(/\/+$/, ""));
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    throw new Error(`Invalid GitHub URL: need at least owner/repo`);
  }

  const owner = segments[0];
  const repo = segments[1];

  // Full URL: /owner/repo/tree/branch/path/to/skill
  if (segments.length > 3 && segments[2] === "tree") {
    const branch = segments[3];
    const remaining = segments.slice(4).join("/");
    const skillId = segments[segments.length - 1];
    return { owner, repo, branch, skillPath: remaining, skillId };
  }

  // Short form: repoUrl + separate skillPath
  const cleanPath = (skillPath ?? "").replace(/^\/+|\/+$/g, "");
  if (!cleanPath) {
    throw new Error("skillPath is required when URL does not contain a tree path");
  }

  const skillId = cleanPath.split("/").pop()!;
  return { owner, repo, branch: "", skillPath: cleanPath, skillId };
}

/**
 * Resolve the default branch if not specified and locate the SKILL.md file.
 * Tries multiple path patterns to find the skill.
 */
async function resolveSource(
  source: GitHubSkillSource,
  token?: string,
): Promise<{ branch: string; skillMdPath: string; refsPath: string | null }> {
  let { branch } = source;

  // Get default branch if not set
  if (!branch) {
    const repoInfo = await ghFetch<{ default_branch: string }>(
      `https://api.github.com/repos/${source.owner}/${source.repo}`,
      token,
    );
    branch = repoInfo.default_branch;
  }

  // Try candidate paths for SKILL.md
  const candidates = [
    source.skillPath + "/SKILL.md",
    "skills/" + source.skillPath + "/SKILL.md",
  ];

  for (const candidate of candidates) {
    try {
      const url = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${candidate}?ref=${branch}`;
      await ghFetch<GitHubContentItem>(url, token);
      const dir = candidate.replace(/\/SKILL\.md$/, "");
      return { branch, skillMdPath: candidate, refsPath: dir + "/references" };
    } catch {
      // Try next candidate
    }
  }

  throw new Error(
    `SKILL.md not found in ${source.owner}/${source.repo} at paths: ${candidates.join(", ")}`,
  );
}

/**
 * Preview a skill from GitHub without importing.
 */
export async function previewGitHubSkill(
  source: GitHubSkillSource,
  token?: string,
): Promise<SkillPreview> {
  const resolved = await resolveSource(source, token);

  // Fetch SKILL.md content
  const fileInfo = await ghFetch<{ download_url: string }>(
    `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${resolved.skillMdPath}?ref=${resolved.branch}`,
    token,
  );
  const raw = await ghFetchRaw(fileInfo.download_url, token);
  const { data, content } = matter(raw);

  // Check for references
  let referenceFiles: string[] = [];
  try {
    const refs = await ghFetch<GitHubContentItem[]>(
      `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${resolved.refsPath}?ref=${resolved.branch}`,
      token,
    );
    referenceFiles = refs
      .filter((r) => r.type === "file" && r.name.endsWith(".md"))
      .map((r) => r.name);
  } catch {
    // No references directory
  }

  return {
    name: (data.name as string) ?? source.skillId,
    description: (data.description as string) ?? "",
    version: data.version as string | undefined,
    promptPreview: content.trim().slice(0, 500),
    hasReferences: referenceFiles.length > 0,
    referenceFiles,
  };
}

/**
 * Import a skill from GitHub into the local skills directory.
 */
export async function importGitHubSkill(
  source: GitHubSkillSource,
  skillsDir: string,
  token?: string,
): Promise<ImportResult> {
  const resolved = await resolveSource(source, token);
  const filesWritten: string[] = [];

  const skillDir = path.join(skillsDir, source.skillId);
  await fs.mkdir(skillDir, { recursive: true });

  // Fetch and write SKILL.md
  const fileInfo = await ghFetch<{ download_url: string }>(
    `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${resolved.skillMdPath}?ref=${resolved.branch}`,
    token,
  );
  const skillMdContent = await ghFetchRaw(fileInfo.download_url, token);
  const skillMdPath = path.join(skillDir, "SKILL.md");
  await fs.writeFile(skillMdPath, skillMdContent, "utf-8");
  filesWritten.push("SKILL.md");

  // Fetch and write references
  try {
    const refs = await ghFetch<GitHubContentItem[]>(
      `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${resolved.refsPath}?ref=${resolved.branch}`,
      token,
    );
    const mdFiles = refs.filter(
      (r) => r.type === "file" && r.name.endsWith(".md") && r.download_url,
    );

    if (mdFiles.length > 0) {
      const refsDir = path.join(skillDir, "references");
      await fs.mkdir(refsDir, { recursive: true });

      for (const ref of mdFiles) {
        const content = await ghFetchRaw(ref.download_url!, token);
        await fs.writeFile(path.join(refsDir, ref.name), content, "utf-8");
        filesWritten.push(`references/${ref.name}`);
      }
    }
  } catch {
    // No references directory - that's fine
  }

  console.log(
    `[GitHub] Imported skill "${source.skillId}" → ${filesWritten.length} files`,
  );
  return { skillId: source.skillId, filesWritten };
}

/**
 * List available skills in a GitHub repository.
 */
export async function listGitHubSkills(
  repoUrl: string,
  token?: string,
): Promise<{ id: string; name: string }[]> {
  const url = new URL(repoUrl.replace(/\/+$/, ""));
  const segments = url.pathname.split("/").filter(Boolean);
  const owner = segments[0];
  const repo = segments[1];

  // Get default branch
  const repoInfo = await ghFetch<{ default_branch: string }>(
    `https://api.github.com/repos/${owner}/${repo}`,
    token,
  );

  // Try listing skills/ directory
  try {
    const items = await ghFetch<GitHubContentItem[]>(
      `https://api.github.com/repos/${owner}/${repo}/contents/skills?ref=${repoInfo.default_branch}`,
      token,
    );
    return items
      .filter((item) => item.type === "dir")
      .map((item) => ({ id: item.name, name: item.name }));
  } catch {
    return [];
  }
}
