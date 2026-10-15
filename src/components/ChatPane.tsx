import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "../types";
import { Icon } from "./Icon";

export function ChatPane({
  messages,
  busy,
  onSend,
}: {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  }

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  return (
    <section className="pane chat-pane" aria-label={t("chat.title")}>
      <div className="messages" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <Icon name="sparkle" size={28} />
            <h3>{t("chat.emptyTitle")}</h3>
            <p className="muted">{t("chat.emptyHint")}</p>
            <div className="chips">
              {suggestions.map((s) => (
                <button key={s} className="chip" onClick={() => onSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="bubble">
              {m.text}
              {m.change && (
                <div className="change">
                  <Icon name="code" size={13} /> model.scad
                  <span className="add">+{m.change.added}</span>
                  <span className="del">−{m.change.removed}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <div className="bubble typing" aria-label={t("chat.thinking")}>
              <i /><i /><i />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
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
          <button type="button" className="icon-btn" title={t("chat.attach")} aria-label={t("chat.attach")}>
            <Icon name="attach" />
          </button>
          <span className="muted hint">{t("chat.hint")}</span>
          <button type="submit" className="primary" disabled={!draft.trim() || busy}>
            <Icon name="send" /> {t("chat.send")}
          </button>
        </div>
      </form>
    </section>
  );
}
