import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Live } from "../chat/useAgentChat";
import type { ChatMessage } from "../types";
import { Icon } from "./Icon";

/** "exec_fc ×3, read_instructions" */
const toolSummary = (tools: string[]) => {
  const n = new Map<string, number>();
  for (const t of tools) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].map(([t, c]) => (c > 1 ? `${t} ×${c}` : t)).join(", ");
};

export function ChatPane({
  messages,
  live,
  working,
  error,
  agent,
  unavailable,
  canCompact,
  onSend,
  onStop,
  onCompact,
  onClear,
}: {
  messages: ChatMessage[];
  live: Live | null;
  working: "answer" | "compact" | null;
  error: string | null;
  /** Who answers, e.g. "Claude". */
  agent: string | null;
  /** Why nobody can answer, if so. */
  unavailable: string | null;
  canCompact: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onCompact: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [sure, setSure] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = working !== null;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, live, error]);
  useEffect(() => {
    if (!sure) return;
    const timer = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(timer);
  }, [sure]);

  function submit() {
    const text = draft.trim();
    if (!text || busy || unavailable) return;
    onSend(text);
    setDraft("");
  }

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  return (
    <section className="pane chat-pane" aria-label={t("chat.title")}>
      <div className="chat-bar">
        <span className="chat-agent">
          <Icon name="sparkle" size={14} /> {agent ?? t("chat.title")}
        </span>
        <span className="grow" />
        <button className="chat-tool" disabled={busy || !canCompact} onClick={onCompact} title={t("chat.compactHint")}>
          {t("chat.compact")}
        </button>
        <button
          className={`chat-tool${sure ? " danger" : ""}`}
          disabled={busy || messages.length === 0}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            onClear();
          }}
        >
          {sure ? t("chat.clearSure") : t("chat.clear")}
        </button>
      </div>
      <div className="messages" role="log" aria-live="polite">
        {messages.length === 0 && !live && (
          <div className="chat-empty">
            <Icon name="sparkle" size={28} />
            <h3>{t("chat.emptyTitle")}</h3>
            <p className="muted">{t("chat.emptyHint")}</p>
            {!unavailable && (
              <div className="chips">
                {suggestions.map((s) => (
                  <button key={s} className="chip" onClick={() => onSend(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m) =>
          m.role === "note" ? (
            <div key={m.id} className="chat-note">
              {m.text === "compacted" ? t("chat.compacted") : m.text}
            </div>
          ) : (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="bubble">
                {m.text}
                {m.tools && <div className="tools">{toolSummary(m.tools)}</div>}
                {m.change && (
                  <div className="change">
                    <Icon name="code" size={13} /> model.scad
                    <span className="add">+{m.change.added}</span>
                    <span className="del">−{m.change.removed}</span>
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {live && (
          <div className="msg assistant">
            {working === "compact" ? (
              <div className="chat-note">{t("chat.compacting")}</div>
            ) : (
              <div className={`bubble${live.text ? "" : " typing"}`} aria-label={t("chat.thinking")}>
                {live.text || (
                  <>
                    <i />
                    <i />
                    <i />
                  </>
                )}
                {live.tools.length > 0 && <div className="tools">{toolSummary(live.tools)}</div>}
              </div>
            )}
          </div>
        )}
        {error && <div className="chat-error" role="alert">{error}</div>}
        <div ref={endRef} />
      </div>
      {unavailable && <div className="chat-error">{unavailable}</div>}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          rows={2}
          disabled={!!unavailable}
          placeholder={t("chat.placeholder")}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-bar">
          <span className="muted hint">{t("chat.hint")}</span>
          {busy ? (
            <button type="button" onClick={onStop}>
              {t("chat.stop")}
            </button>
          ) : (
            <button type="submit" className="primary" disabled={!draft.trim() || !!unavailable}>
              <Icon name="send" /> {t("chat.send")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
