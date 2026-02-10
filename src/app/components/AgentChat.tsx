"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SkillInfo = {
  id: string;
  name: string;
  description: string;
  version?: string;
};

type PreviewData = {
  name: string;
  description: string;
  version?: string;
  promptPreview: string;
  hasReferences: boolean;
  referenceFiles: string[];
};

type RepoSkill = {
  id: string;
  name: string;
};

export type ChatMode = "skill" | "plain" | "gemini";

export type AgentChatHandle = {
  sendMessage: (message: string) => Promise<void>;
  setInput: (text: string) => void;
};

function SkillBadge({
  label,
  onClick,
  clickable = false,
  active = false,
}: {
  label: string;
  onClick?: () => void;
  clickable?: boolean;
  active?: boolean;
}) {
  return (
    <span
      onClick={clickable ? onClick : undefined}
      style={{
        display: "inline-block",
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 500,
        color: active ? "white" : "var(--accent)",
        background: active ? "var(--accent)" : "var(--accent-light)",
        border: "1px solid var(--accent)",
        borderRadius: 4,
        cursor: clickable ? "pointer" : "default",
        transition: clickable ? "all 0.15s ease" : "none",
      }}
      onMouseEnter={(e) => {
        if (clickable && !active) {
          e.currentTarget.style.background = "var(--accent)";
          e.currentTarget.style.color = "white";
        }
      }}
      onMouseLeave={(e) => {
        if (clickable && !active) {
          e.currentTarget.style.background = "var(--accent-light)";
          e.currentTarget.style.color = "var(--accent)";
        }
      }}
    >
      {label}
    </span>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  );
}

/* ─── Import Dialog ─── */

function ImportSkillDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [repoUrl, setRepoUrl] = useState("https://github.com/coreyhaines31/marketingskills");
  const [skillPath, setSkillPath] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [repoSkills, setRepoSkills] = useState<RepoSkill[]>([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleListSkills() {
    setError("");
    setRepoSkills([]);
    setPreview(null);
    setLoading(true);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, action: "list" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRepoSkills(data.skills ?? []);
      if (data.skills?.length === 0) {
        setError("skills/ ディレクトリにSkillが見つかりませんでした");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(path?: string) {
    const target = path ?? skillPath;
    if (!target) return;
    setError("");
    setSuccess("");
    setPreview(null);
    setLoading(true);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, skillPath: target, action: "preview" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.preview);
      setSkillPath(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!skillPath) return;
    setError("");
    setSuccess("");
    setImporting(true);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, skillPath, action: "import" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(
        `「${preview?.name ?? skillPath}」をインポートしました (${data.filesWritten?.length ?? 0} ファイル)`,
      );
      setPreview(null);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.2))",
          padding: 24,
          width: "min(520px, 90vw)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            GitHub からSkillをインポート
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 18,
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
          Skillを公開しているリポジトリURL
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text-primary)",
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              outline: "none",
            }}
          />
          <button
            onClick={handleListSkills}
            disabled={loading || !repoUrl}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--accent)",
              background: "var(--accent-light)",
              border: "1px solid var(--accent)",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading && !preview ? "読込中..." : "Skill一覧を取得"}
          </button>
        </div>

        {repoSkills.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              利用可能なSkill ({repoSkills.length})
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {repoSkills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handlePreview(s.id)}
                  style={{
                    padding: "5px 10px",
                    fontSize: 12,
                    color: skillPath === s.id ? "white" : "var(--text-secondary)",
                    background: skillPath === s.id ? "var(--accent)" : "var(--bg-chat, #f5f5f5)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {s.id}
                </button>
              ))}
            </div>
          </div>
        )}

        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
          Skillパス
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={skillPath}
            onChange={(e) => setSkillPath(e.target.value)}
            placeholder="copywriting"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text-primary)",
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              outline: "none",
            }}
          />
          <button
            onClick={() => handlePreview()}
            disabled={loading || !skillPath}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 500,
              color: "white",
              background: loading ? "var(--text-muted)" : "var(--accent)",
              border: "none",
              borderRadius: 8,
              cursor: loading || !skillPath ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            プレビュー
          </button>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", fontSize: 13, color: "#dc2626", background: "#fef2f2", borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "8px 12px", fontSize: 13, color: "#16a34a", background: "#f0fdf4", borderRadius: 8, marginBottom: 12 }}>
            {success}
          </div>
        )}

        {preview && (
          <div
            style={{
              background: "var(--bg-chat, #fafafa)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                {preview.name}
              </h4>
              {preview.version && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>
                  v{preview.version}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>
              {preview.description}
            </p>
            {preview.hasReferences && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
                参照ファイル: {preview.referenceFiles.join(", ")}
              </p>
            )}
            <details style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <summary style={{ cursor: "pointer", marginBottom: 4 }}>プロンプトプレビュー</summary>
              <pre style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", background: "var(--bg-secondary)", padding: 8, borderRadius: 6, maxHeight: 200, overflowY: "auto", margin: 0 }}>
                {preview.promptPreview}...
              </pre>
            </details>

            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "white",
                background: importing ? "var(--text-muted)" : "var(--accent)",
                border: "none",
                borderRadius: 8,
                cursor: importing ? "not-allowed" : "pointer",
                transition: "background 0.15s ease",
              }}
            >
              {importing ? "インポート中..." : "インポート"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Assistant Avatar ─── */

function AssistantLabel() {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-muted)",
        marginRight: 12,
        marginTop: 4,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      AI
    </div>
  );
}

/* ─── Mode Config ─── */

const AVAILABLE_MODELS = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview" },
  ],
  plain: [
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-6-20250514", name: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ],
  skill: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Router)" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite (Router)" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview (Router)" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Router)" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview (Router)" },
  ],
} as const;

const MODE_CONFIG = {
  gemini: {
    title: "Gemini Direct",
    subtitle: "1. Gemini API 直接呼び出し (Function Calling なし)",
    systemInstruction: "You are a helpful assistant. Respond in the same language as the user input.",
    accent: "#4285f4",
    endpoint: "/api/gemini",
    emptyTitle: "何でも聞いてください",
    emptySubtitle: "Gemini が直接応答します（Skillなし）",
    placeholder: "メッセージを入力...",
    icon: "gemini" as const,
    defaultModel: "gemini-2.5-flash",
  },
  plain: {
    title: "Claude Direct",
    subtitle: "1. Claude API 直接呼び出し (Tool Use なし)",
    systemInstruction: "You are a helpful assistant. Respond in the same language as the user input.",
    accent: "#6366f1",
    endpoint: "/api/chat",
    emptyTitle: "何でも聞いてください",
    emptySubtitle: "Claude が直接応答します（Skillなし）",
    placeholder: "メッセージを入力...",
    icon: "claude" as const,
    defaultModel: "claude-sonnet-4-5-20250929",
  },
  skill: {
    title: "Skill Agent",
    subtitle: "1. ユーザーリクエスト → 2. ADK Router Agent → 3. Function Calling: run_skill → 4. Claude Agent SDK (Sonnet 4.5) → 5. SKILL.md 読込 & 実行 → 6. 結果を返却",
    systemInstruction: `あなたはユーザーのリクエストを分析し、最適なSkillを選んで実行するエージェントです。

## ルール
1. ユーザーのリクエスト内容を分析し、最も適切なSkillを選択する
2. Skillが見つかったら run_skill ツールを使って実行する
3. Skillの実行結果をユーザーにそのまま返す
4. どのSkillにも合わないリクエストの場合は、利用可能なSkill一覧を提示して選択を促す
5. 日本語で応答する`,
    accent: "var(--accent)",
    endpoint: "/api/agent",
    emptyTitle: "Skillに何でも聞いてください",
    emptySubtitle: "リクエスト内容に応じて最適なSkillを自動選択します",
    placeholder: "メッセージを入力...",
    icon: "skill" as const,
    defaultModel: "gemini-2.5-flash",
  },
} as const;

/* ─── Main Chat Component ─── */

interface AgentChatProps {
  mode?: ChatMode;
  showSystemInstruction?: boolean;
  onToggleSystemInstruction?: () => void;
  showSkills?: boolean;
  onToggleSkills?: () => void;
  onLog?: (entry: string) => void;
}

const AgentChat = forwardRef<AgentChatHandle, AgentChatProps>(
  ({ mode = "skill", showSystemInstruction = false, onToggleSystemInstruction, showSkills = false, onToggleSkills, onLog }, ref) => {
    const config = MODE_CONFIG[mode];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [usedSkills, setUsedSkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(config.defaultModel);
  const [activeSkillPrompt, setActiveSkillPrompt] = useState<string | null>(null);
  const [activeSkillName, setActiveSkillName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (data.skills) setSkills(data.skills);
    } catch {
      // Silent fail
    }
  }, []);

  const handleSkillClick = useCallback(async (skillId: string, skillName: string) => {
    if (loading) return;
    console.log(`[${mode}] Skill selected: ${skillName}`);

    if (mode === "skill") {
      // Append skill prefix to existing input
      const prefix = `${skillName}Skillを使って、`;
      setInput((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed}\n${prefix}` : prefix;
      });
      inputRef.current?.focus();
      setTimeout(() => {
        if (inputRef.current) {
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 0);
    } else {
      // For plain/gemini: load full skill prompt and embed in message
      if (activeSkillName === skillName) {
        // Toggle off if same skill clicked again
        setActiveSkillPrompt(null);
        setActiveSkillName(null);
        return;
      }
      try {
        const res = await fetch(`/api/skills/${skillId}`);
        const data = await res.json();
        if (data.prompt) {
          setActiveSkillPrompt(data.prompt);
          setActiveSkillName(data.name);
          inputRef.current?.focus();
        }
      } catch {
        // Silent fail
      }
    }
  }, [loading, mode, activeSkillName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || loading) return;

    // Capture skill state before clearing
    const skillPrompt = activeSkillPrompt;
    const skillName = activeSkillName;
    const logMsg = `[${mode}] Sending: ${userMessage} | skill=${skillName || "none"}`;
    console.log(logMsg);
    onLog?.(logMsg);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setStreamingText("");
    setCurrentSkill(null);
    // Keep activeSkillPrompt/activeSkillName — user dismisses manually

    // Build the actual message to send
    // For plain/gemini with active skill: embed skill prompt in message (same pattern as runner.ts)
    const apiMessage = (mode !== "skill" && skillPrompt)
      ? `# Skill Instructions\n${skillPrompt}\n\n# User Input\n${userMessage}`
      : userMessage;

    try {
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: apiMessage, model: selectedModel }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          try {
            const event = JSON.parse(data);
            if (event.type === "text_delta") {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === "skill_used") {
              const skillLog = `[${mode}] Skill fired: ${event.skillName}`;
              console.log(skillLog);
              onLog?.(skillLog);
              setCurrentSkill(event.skillName);
              setUsedSkills((prev) => {
                if (!prev.includes(event.skillName)) {
                  return [...prev, event.skillName];
                }
                return prev;
              });
            } else if (event.type === "error") {
              const errLog = `[${mode}] Error: ${event.message}`;
              console.log(errLog);
              onLog?.(errLog);
              accumulated += `\n\nError: ${event.message}`;
              setStreamingText(accumulated);
            }
          } catch {
            // Skip
          }
        }
      }

      const charCount = accumulated.length >= 1000
        ? `${(accumulated.length / 1000).toFixed(1)}k`
        : `${accumulated.length}`;
      const doneLog = `[${mode}] Done: ${charCount} chars`;
      console.log(doneLog);
      onLog?.(doneLog);

      // Track skill usage for plain/gemini modes
      if (skillName) {
        setUsedSkills((prev) =>
          prev.includes(skillName) ? prev : [...prev, skillName]
        );
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: accumulated },
      ]);
      setStreamingText("");
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        },
      ]);
      setStreamingText("");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, config.endpoint, selectedModel, mode, activeSkillPrompt, activeSkillName, onLog]);

  // Expose sendMessage and setInput via ref
  useImperativeHandle(ref, () => ({
    sendMessage,
    setInput: (text: string) => {
      setInput(text);
      inputRef.current?.focus();
    },
  }), [sendMessage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    await sendMessage(userMessage);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 52,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <h1
            title={config.subtitle}
            style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap" }}
          >
            {config.title}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              color: "var(--text-primary)",
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              outline: "none",
              cursor: "pointer",
            }}
          >
            {AVAILABLE_MODELS[mode].map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleSystemInstruction}
            className="toolbar-btn"
            title="System Instruction"
            style={{
              width: 28,
              height: 28,
              color: showSystemInstruction ? "var(--accent)" : undefined,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* System Instruction (collapsible) */}
      {showSystemInstruction && (
        <div
          style={{
            padding: "12px 24px",
            background: "var(--bg-chat)",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {/* Flow description */}
          <div style={{
            marginBottom: 10,
            paddingBottom: 10,
            borderBottom: "1px dashed var(--border)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
          }}>
            {config.subtitle}
          </div>
          {/* System instruction */}
          <pre style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: 12,
          }}>
            {config.systemInstruction}
          </pre>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          background: "var(--bg-chat)",
          position: "relative",
        }}
      >
        {/* Gear icon for Skill import (right side of skill column) */}
        {mode === "skill" && (
          <button
            onClick={() => setShowImport(true)}
            title="GitHubからSkillをインポート"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "50%",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "var(--shadow-sm)",
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="M1 12h6m6 0h6" />
            </svg>
          </button>
        )}
        {isEmpty && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 16,
              padding: "24px 0",
            }}
          >
            <div style={{ textAlign: "center", maxWidth: 520 }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>
                {config.emptyTitle}
              </p>
              <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                {config.emptySubtitle}
              </p>
            </div>

          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className="message-enter"
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
              animationDelay: `${Math.min(i * 0.05, 0.2)}s`,
            }}
          >
            {msg.role === "assistant" && (
              <AssistantLabel />
            )}
            <div
              className="markdown-body"
              style={{
                maxWidth: "80%",
                borderRadius: 4,
                padding: "14px 18px",
                fontSize: 16,
                lineHeight: 1.7,
                wordBreak: "break-word",
                background: msg.role === "user" ? config.accent : "var(--assistant-bubble)",
                color: msg.role === "user" ? "white" : "var(--assistant-text)",
                boxShadow: msg.role === "user" ? "none" : "var(--shadow-sm)",
              }}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="message-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <AssistantLabel />
            <div
              className="markdown-body"
              style={{
                maxWidth: "80%",
                borderRadius: 4,
                padding: "14px 18px",
                fontSize: 16,
                lineHeight: 1.7,
                wordBreak: "break-word",
                background: "var(--assistant-bubble)",
                color: "var(--assistant-text)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <ReactMarkdown>{streamingText}</ReactMarkdown>
              <span className="typing-cursor" />
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div className="message-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <AssistantLabel />
            <div
              style={{
                borderRadius: 4,
                padding: "14px 18px",
                background: "var(--assistant-bubble)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <LoadingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Skill selector section (collapsible, above input) */}
      {skills.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          {/* Toggle header */}
          <button
            type="button"
            onClick={onToggleSkills}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "6px 14px",
              background: "none",
              border: "none",
              borderBottom: showSkills ? "1px solid var(--border)" : "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
              style={{ transition: "transform 0.15s", transform: showSkills ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <path d="M8 5l8 7-8 7V5z" />
            </svg>
            Skills ({skills.length})
            {activeSkillName && (
              <span style={{
                marginLeft: 4,
                padding: "1px 6px",
                fontSize: 10,
                fontWeight: 500,
                color: "white",
                background: "var(--accent)",
                borderRadius: 3,
                textTransform: "none",
                letterSpacing: 0,
              }}>
                {activeSkillName}
              </span>
            )}
          </button>
          {/* Skill badges (wrap, not scroll) */}
          {showSkills && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              padding: "8px 14px",
            }}>
              {skills.map((s) => (
                <SkillBadge
                  key={s.id}
                  label={s.name}
                  clickable={true}
                  active={activeSkillName === s.name}
                  onClick={() => handleSkillClick(s.id, s.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "12px 14px 14px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-secondary)",
        }}
      >
        {/* Skill execution status (skill mode only) */}
        {mode === "skill" && (currentSkill || usedSkills.length > 0) && (
          <div style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}>
            {currentSkill && (
              <>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>実行中:</span>
                <SkillBadge label={currentSkill} active={true} />
              </>
            )}
            {!currentSkill && usedSkills.length > 0 && (
              <>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>使用:</span>
                {usedSkills.map((name, i) => (
                  <SkillBadge key={i} label={name} active={true} />
                ))}
              </>
            )}
          </div>
        )}
        {mode !== "skill" && activeSkillName && (
          <div
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <SkillBadge label={activeSkillName} active={true} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              のプロンプトを適用中
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveSkillPrompt(null);
                setActiveSkillName(null);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 14,
                padding: "2px 6px",
              }}
            >
              ✕
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{
            background: "var(--input-textarea-bg)",
            borderRadius: 8,
            padding: "12px 14px 8px",
          }}>
            <textarea
              ref={inputRef}
              className="chat-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              disabled={loading}
              rows={3}
              style={{
                width: "100%",
                padding: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--text-primary)",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
                resize: "none",
              }}
            />

            {/* Toolbar */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 8,
            }}>
              {/* Left: action icons */}
              <div style={{ display: "flex", gap: 2 }}>
                <button type="button" className="toolbar-btn" title="画像を添付" disabled>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                </button>
                <button type="button" className="toolbar-btn" title="ファイルを添付" disabled>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                  </svg>
                </button>
                <button type="button" className="toolbar-btn" title="絵文字" disabled>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                  </svg>
                </button>
              </div>

              {/* Right: send button */}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: (loading || !input.trim()) ? "var(--text-muted)" : "white",
                  background: (loading || !input.trim()) ? "var(--bg-chat, #f5f5f5)" : "var(--accent)",
                  border: "1px solid",
                  borderColor: (loading || !input.trim()) ? "var(--border)" : "var(--accent)",
                  borderRadius: 6,
                  cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
                  opacity: (loading || !input.trim()) ? 0.5 : 1,
                }}
              >
                {loading ? "送信中..." : "送信"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showImport && (
        <ImportSkillDialog
          onClose={() => setShowImport(false)}
          onImported={() => fetchSkills()}
        />
      )}
    </div>
  );
});

AgentChat.displayName = "AgentChat";

export default AgentChat;
