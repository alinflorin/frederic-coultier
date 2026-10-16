import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ModelInfo } from "../chat/engines";
import type { Live } from "../chat/useAgentChat";
import type { Attached, ChatMessage, ToolCall } from "../types";
import { Icon } from "./Icon";

/** The tool calls of one answer, each folded up until clicked: what was asked, what came back, pictures included. */
function Tools({ tools }: { tools: ToolCall[] }) {
  const { t } = useTranslation();
  return (
    <div className="tools">
      {tools.map((c, i) => (
        <details key={c.id || i} className={`tool${c.error ? " failed" : ""}`}>
          <summary>
            <span className="tool-name">{c.name}</span>
            {c.input && <span className="tool-arg">{c.input.split("\n")[0]}</span>}
            {!c.done && <span className="tool-wait">…</span>}
          </summary>
          {c.input && <pre className="tool-in">{c.input}</pre>}
          {c.output.map((p, j) =>
            p.type === "text" ? (
              <pre key={j} className="tool-out">{p.text}</pre>
            ) : (
              <img key={j} className="tool-img" alt={t("chat.picture")} src={`data:${p.mime};base64,${p.data}`} />
            ),
          )}
        </details>
      ))}
    </div>
  );
}

const MAX_FILE = 15_000_000;

const readFile = (f: File) =>
  new Promise<Attached>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const url = String(r.result);
      resolve({ name: f.name || "image", mime: f.type, data: url.slice(url.indexOf(",") + 1) });
    };
    r.readAsDataURL(f);
  });

/** What was attached to a message: pictures as thumbnails, other files as names. */
function Files({ files, onRemove }: { files: Attached[]; onRemove?: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="files">
      {files.map((f, i) => (
        <span key={i} className="file" title={f.name}>
          {f.data && f.mime.startsWith("image/") ? (
            <img alt={f.name} src={`data:${f.mime};base64,${f.data}`} />
          ) : (
            <Icon name="code" size={13} />
          )}
          <span className="file-name">{f.name}</span>
          {onRemove && (
            <button type="button" className="file-x" aria-label={t("chat.remove")} title={t("chat.remove")} onClick={() => onRemove(i)}>
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function ChatPane({
  messages,
  live,
  working,
  error,
  agent,
  unavailable,
  canCompact,
  models,
  model,
  efforts,
  effort,
  onModel,
  onEffort,
  pdf,
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
  models: ModelInfo[];
  /** The picked model, "" for the agent's own choice. */
  model: string;
  efforts: string[];
  effort: string;
  onModel: (id: string) => void;
  onEffort: (level: string) => void;
  /** Whether the agent can read PDF files. */
  pdf: boolean;
  onSend: (text: string, files?: Attached[]) => void;
  onStop: () => void;
  onCompact: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [sure, setSure] = useState(false);
  const [files, setFiles] = useState<Attached[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
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
    if ((!text && files.length === 0) || busy || unavailable) return;
    onSend(text || files.map((f) => f.name).join(", "), files);
    setDraft("");
    setFiles([]);
    setProblem(null);
  }

  async function attach(list: File[]) {
    const ok: File[] = [];
    let bad: string | null = null;
    for (const f of list) {
      if (f.size > MAX_FILE) bad = t("chat.tooBig", { name: f.name });
      else if (f.type === "application/pdf" && !pdf) bad = t("chat.noPdf", { agent: agent ?? "" });
      else ok.push(f);
    }
    setProblem(bad);
    try {
      const read = await Promise.all(ok.map(readFile));
      setFiles((cur) => [...cur, ...read]);
    } catch {
      setProblem(t("chat.attach"));
    }
  }

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  return (
    <section className="pane chat-pane" aria-label={t("chat.title")}>
      <div className="chat-bar">
        <span className="chat-agent">
          <Icon name="sparkle" size={14} /> {agent ?? t("chat.title")}
        </span>
        <span className="grow" />
        {models.length > 0 && (
          <select className="chat-pick" aria-label={t("chat.model")} title={t("chat.model")} value={model} disabled={busy} onChange={(e) => onModel(e.currentTarget.value)}>
            <option value="">{t("chat.default")}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
        {efforts.length > 0 && (
          <select className="chat-pick" aria-label={t("chat.effort")} title={t("chat.effort")} value={effort} disabled={busy} onChange={(e) => onEffort(e.currentTarget.value)}>
            <option value="">{t("chat.effortDefault")}</option>
            {efforts.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
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
                {m.files && m.files.length > 0 && <Files files={m.files} />}
                {m.text}
                {m.tools && <Tools tools={m.tools.filter((c) => typeof c === "object")} />}
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
                {live.tools.length > 0 && <Tools tools={live.tools} />}
              </div>
            )}
          </div>
        )}
        {error && <div className="chat-error" role="alert">{error}</div>}
        <div ref={endRef} />
      </div>
      {unavailable && <div className="chat-error">{unavailable}</div>}
      <form
        className={`composer${over ? " over" : ""}`}
        onDragOver={(e) => {
          if (unavailable || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          if (unavailable || e.dataTransfer.files.length === 0) return;
          e.preventDefault();
          attach([...e.dataTransfer.files]);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {files.length > 0 && <Files files={files} onRemove={(i) => setFiles((cur) => cur.filter((_, j) => j !== i))} />}
        {problem && <div className="chat-error">{problem}</div>}
        <textarea
          value={draft}
          rows={2}
          disabled={!!unavailable}
          placeholder={t("chat.placeholder")}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onPaste={(e) => {
            const pasted = [...e.clipboardData.files];
            if (pasted.length === 0) return;
            e.preventDefault();
            attach(pasted);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-bar">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              attach([...(e.currentTarget.files ?? [])]);
              e.currentTarget.value = "";
            }}
          />
          <button type="button" className="chat-tool" disabled={!!unavailable} title={t("chat.attach")} aria-label={t("chat.attach")} onClick={() => picker.current?.click()}>
            +
          </button>
          <span className="muted hint">{t("chat.hint")}</span>
          {busy ? (
            <button type="button" onClick={onStop}>
              {t("chat.stop")}
            </button>
          ) : (
            <button type="submit" className="primary" disabled={(!draft.trim() && files.length === 0) || !!unavailable}>
              <Icon name="send" /> {t("chat.send")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
