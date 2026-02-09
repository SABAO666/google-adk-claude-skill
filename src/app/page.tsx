"use client";

import { useRef, useState, useCallback } from "react";
import AgentChat, { type AgentChatHandle } from "./components/AgentChat";

export default function Home() {
  const [globalInput, setGlobalInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSystemInstruction, setShowSystemInstruction] = useState(false);

  const geminiRef = useRef<AgentChatHandle>(null);
  const plainRef = useRef<AgentChatHandle>(null);
  const skillRef = useRef<AgentChatHandle>(null);
  const globalInputRef = useRef<HTMLTextAreaElement>(null);

  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalInput.trim() || isSending) return;

    const message = globalInput.trim();
    setGlobalInput("");
    setIsSending(true);

    // 3つ全てに同時送信
    await Promise.all([
      geminiRef.current?.sendMessage(message),
      plainRef.current?.sendMessage(message),
      skillRef.current?.sendMessage(message),
    ]);

    setIsSending(false);
  };

  const handleGlobalKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleGlobalSubmit(e as unknown as React.FormEvent);
    }
  }, [globalInput, isSending]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--border)",
      }}
    >
      {/* 3カラムレイアウト */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 1,
          minHeight: 0,
        }}
      >
        {/* Left: Gemini Direct (no skills) */}
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)" }}>
          <AgentChat
            ref={geminiRef}
            mode="gemini"
            showSystemInstruction={showSystemInstruction}
            onToggleSystemInstruction={() => setShowSystemInstruction(!showSystemInstruction)}
          />
        </div>

        {/* Center: Plain Claude (no skills) */}
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)" }}>
          <AgentChat
            ref={plainRef}
            mode="plain"
            showSystemInstruction={showSystemInstruction}
            onToggleSystemInstruction={() => setShowSystemInstruction(!showSystemInstruction)}
          />
        </div>

        {/* Right: Skill Agent (ADK + skills) */}
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-primary)" }}>
          <AgentChat
            ref={skillRef}
            mode="skill"
            showSystemInstruction={showSystemInstruction}
            onToggleSystemInstruction={() => setShowSystemInstruction(!showSystemInstruction)}
          />
        </div>
      </div>

      {/* Floating global input */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 32px 20px",
          background: "var(--bg-primary)",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -2px 12px rgba(0, 0, 0, 0.06)",
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className="global-input-card">
            {/* Card header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}>
                Send to All Agents
              </span>
            </div>

            {/* Card body */}
            <div style={{ padding: "12px 16px 8px" }}>
              <form onSubmit={handleGlobalSubmit}>
                <textarea
                  ref={globalInputRef}
                  className="chat-textarea"
                  value={globalInput}
                  onChange={(e) => setGlobalInput(e.target.value)}
                  onKeyDown={handleGlobalKeyDown}
                  placeholder="3つ全てに送信するメッセージを入力..."
                  disabled={isSending}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "4px 0",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "var(--text-primary)",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "none",
                    minHeight: 48,
                    maxHeight: 120,
                  }}
                />

                {/* Toolbar */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 8,
                  paddingBottom: 4,
                }}>
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

                  <button
                    type="submit"
                    className="send-btn"
                    disabled={isSending || !globalInput.trim()}
                    title={isSending ? "送信中..." : "一括送信"}
                    style={{ width: 40, height: 40 }}
                  >
                    {isSending ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
