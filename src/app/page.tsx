"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import AgentChat, { type AgentChatHandle } from "./components/AgentChat";

export default function Home() {
  const [globalInput, setGlobalInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSystemInstruction, setShowSystemInstruction] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const geminiRef = useRef<AgentChatHandle>(null);
  const plainRef = useRef<AgentChatHandle>(null);
  const skillRef = useRef<AgentChatHandle>(null);
  const globalInputRef = useRef<HTMLTextAreaElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((entry: string) => {
    const ts = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, `${ts} ${entry}`]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Apply: insert text into all 3 inputs without sending
  const handleApplyToInputs = useCallback(() => {
    if (!globalInput.trim()) return;
    const text = globalInput.trim();
    geminiRef.current?.setInput(text);
    plainRef.current?.setInput(text);
    skillRef.current?.setInput(text);
    setGlobalInput("");
    const msg = `[Global] Applied to all inputs: ${text}`;
    console.log(msg);
    addLog(msg);
  }, [globalInput, addLog]);

  // Broadcast: send to all 3 agents
  const handleBroadcastSend = useCallback(async () => {
    if (!globalInput.trim() || isSending) return;
    const message = globalInput.trim();
    setGlobalInput("");
    setIsSending(true);
    const bMsg = `[Global] Broadcasting: ${message}`;
    console.log(bMsg);
    addLog(bMsg);

    await Promise.all([
      geminiRef.current?.sendMessage(message),
      plainRef.current?.sendMessage(message),
      skillRef.current?.sendMessage(message),
    ]);

    setIsSending(false);
  }, [globalInput, isSending, addLog]);

  const handleGlobalKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleBroadcastSend();
    }
  }, [handleBroadcastSend]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--border)" }}>

      {/* 3-column chat + log column */}
      <div style={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)" }}>
          <AgentChat ref={geminiRef} mode="gemini" showSystemInstruction={showSystemInstruction} onToggleSystemInstruction={() => setShowSystemInstruction(!showSystemInstruction)} showSkills={showSkills} onToggleSkills={() => setShowSkills(!showSkills)} onLog={addLog} />
        </div>
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)" }}>
          <AgentChat ref={plainRef} mode="plain" showSystemInstruction={showSystemInstruction} onToggleSystemInstruction={() => setShowSystemInstruction(!showSystemInstruction)} showSkills={showSkills} onToggleSkills={() => setShowSkills(!showSkills)} onLog={addLog} />
        </div>
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)" }}>
          <AgentChat ref={skillRef} mode="skill" showSystemInstruction={showSystemInstruction} onToggleSystemInstruction={() => setShowSystemInstruction(!showSystemInstruction)} showSkills={showSkills} onToggleSkills={() => setShowSkills(!showSkills)} onLog={addLog} />
        </div>
        {/* Log monitor column */}
        <div style={{ width: 280, minWidth: 280, background: "var(--bg-chat, #f0f0f0)", display: "flex", flexDirection: "column" }}>
          <div style={{
            padding: "12px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 52,
          }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Log</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setShowSystemInstruction(!showSystemInstruction)}
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
              <button
                type="button"
                onClick={() => setLogs([])}
                style={{
                  padding: "2px 8px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 10px",
            fontFamily: "monospace",
            fontSize: 11,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}>
            {logs.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Waiting for events...</div>
            )}
            {logs.map((entry, i) => (
              <div key={i} style={{
                borderBottom: "1px solid var(--border)",
                paddingBottom: 3,
                marginBottom: 3,
                color: entry.includes("Error") ? "#d9534f"
                  : entry.includes("Skill fired") ? "#2e8b57"
                  : entry.includes("Done") ? "#3a7bd5"
                  : entry.includes("Sending") ? "#b8860b"
                  : "var(--text-secondary)",
              }}>
                {entry}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Global input — above individual inputs, spanning full width */}
      <div style={{
        padding: "8px 16px",
        background: "var(--bg-primary)",
        borderTop: "1px solid var(--border)",
      }}>
        <div className="global-input-card" style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ padding: "8px 14px 6px" }}>
            <textarea
              ref={globalInputRef}
              className="chat-textarea"
              value={globalInput}
              onChange={(e) => setGlobalInput(e.target.value)}
              onKeyDown={handleGlobalKeyDown}
              placeholder="3つ全てに送るメッセージを入力... (Shift+Enter で各Skill適用＆一斉送信)"
              disabled={isSending}
              rows={1}
              style={{
                width: "100%",
                padding: "4px 0",
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
                resize: "none",
                minHeight: 28,
                maxHeight: 80,
              }}
            />
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingTop: 4, paddingBottom: 2 }}>
              <button
                type="button"
                onClick={handleApplyToInputs}
                disabled={!globalInput.trim()}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: !globalInput.trim() ? "var(--text-muted)" : "var(--text-secondary)",
                  background: "var(--bg-chat, #f5f5f5)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: !globalInput.trim() ? "not-allowed" : "pointer",
                  opacity: !globalInput.trim() ? 0.5 : 1,
                }}
              >
                入力欄に適用
              </button>
              <button
                type="button"
                onClick={handleBroadcastSend}
                disabled={isSending || !globalInput.trim()}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: (isSending || !globalInput.trim()) ? "var(--text-muted)" : "white",
                  background: (isSending || !globalInput.trim()) ? "var(--bg-chat, #f5f5f5)" : "var(--accent)",
                  border: "1px solid",
                  borderColor: (isSending || !globalInput.trim()) ? "var(--border)" : "var(--accent)",
                  borderRadius: 6,
                  cursor: (isSending || !globalInput.trim()) ? "not-allowed" : "pointer",
                  opacity: (isSending || !globalInput.trim()) ? 0.5 : 1,
                }}
              >
                {isSending ? "送信中..." : "一斉送信"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
