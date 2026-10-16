import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { EngineInfo, ModelInfo } from "../chat/engines";
import type { Live } from "../chat/useAgentChat";
import type { Attached, ChatLog, Limit, ChatMessage, ToolCall } from "../types";
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

/** A small bar with a number: how much of something is used up. */
function Meter({ label, percent, title }: { label: string; percent: number; title: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <span className={`meter${p >= 95 ? " full" : p >= 80 ? " high" : ""}`} title={title}>
      <span className="meter-label">{label}</span>
      <span className="meter-bar">
        <i style={{ width: `${p}%` }} />
      </span>
      <span className="meter-num">{Math.round(percent)}%</span>
    </span>
  );
}

export function ChatPane({
  conversations,
  activeId,
  messages,
  live,
  working,
  error,
  agent,
  engines,
  engineId,
  onEngine,
  context,
  limits,
  unavailable,
  canCompact,
  models,
  model,
  modelDefault,
  effortDefault,
  efforts,
  effort,
  onModel,
  onEffort,
  pdf,
  files,
  setFiles,
  onSend,
  onStop,
  onCompact,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ChatLog[];
  activeId: string;
  messages: ChatMessage[];
  live: Live | null;
  working: "answer" | "compact" | null;
  error: string | null;
  /** Who answers, e.g. "Claude". */
  agent: string | null;
  /** Every agent the app knows, usable or not. */
  engines: EngineInfo[];
  engineId: string;
  /** Switches the agent for the whole app, not just this project. */
  onEngine: (id: string) => void;
  /** How full the conversation is, if the agent said. */
  context?: ChatLog["context"];
  /** The account's plan limits, if the agent said. */
  limits: Limit[];
  /** Why nobody can answer, if so. */
  unavailable: string | null;
  canCompact: boolean;
  models: ModelInfo[];
  /** The picked model, "" for the agent's own choice. */
  model: string;
  /** Name of the model Preferences picked, "" if it leaves the choice to the agent. */
  modelDefault: string;
  /** Likewise for the thinking level that applies to the model on show. */
  effortDefault: string;
  efforts: string[];
  effort: string;
  onModel: (id: string) => void;
  onEffort: (level: string) => void;
  /** Whether the agent can read PDF files. */
  pdf: boolean;
  /** What is attached to the message being written (kept by the app, so the preview can add to it). */
  files: Attached[];
  setFiles: Dispatch<SetStateAction<Attached[]>>;
  onSend: (text: string, files?: Attached[]) => void;
  onStop: () => void;
  onCompact: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [sure, setSure] = useState(false);
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

  const usedContext = context && context.engine === engineId && context.window > 0 ? context : null;
  // a window that has started over since the agent last said is no use
  const shownLimits = limits.filter((l) => !l.resetsAt || l.resetsAt * 1000 > Date.now());

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  return (
    <section className="pane chat-pane" aria-label={t("chat.title")}>
      <div className="chat-bars">
        <div className="chat-bar">
        <span className="chat-agent">
          <Icon name="sparkle" size={14} />
          {engines.length > 1 && engineId ? (
            <select className="chat-pick" aria-label={t("chat.agent")} title={t("chat.agentHint")} value={engineId} disabled={busy} onChange={(e) => onEngine(e.currentTarget.value)}>
              {engines.map((e) => (
                <option key={e.id} value={e.id} disabled={!e.available}>{e.label}</option>
              ))}
            </select>
          ) : (
            agent ?? t("chat.title")
          )}
        </span>
          <span className="grow" />
        {models.length > 0 && (
          <select className="chat-pick" aria-label={t("chat.model")} title={t("chat.model")} value={model} disabled={busy} onChange={(e) => onModel(e.currentTarget.value)}>
            <option value="">{modelDefault ? t("chat.defaultNamed", { name: modelDefault }) : t("chat.default")}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
        {efforts.length > 0 && (
          <select className="chat-pick" aria-label={t("chat.effort")} title={t("chat.effort")} value={effort} disabled={busy} onChange={(e) => onEffort(e.currentTarget.value)}>
            <option value="">{effortDefault ? t("chat.defaultNamed", { name: effortDefault }) : t("chat.effortDefault")}</option>
            {efforts.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
        </div>
        <div className="chat-bar">
        <select
          className="chat-pick chat-convo"
          aria-label={t("chat.conversation")}
          title={t("chat.conversation")}
          value={activeId}
          disabled={busy}
          onChange={(e) => onSelect(e.currentTarget.value)}
        >
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>{c.title || t("chat.untitled")}</option>
          ))}
        </select>
        <button className="chat-tool" disabled={busy || messages.length === 0} onClick={onNew} title={t("chat.new")}>
          +
        </button>
        <button className="chat-tool" disabled={busy || !canCompact} onClick={onCompact} title={t("chat.compactHint")}>
          {t("chat.compact")}
        </button>
        <button
          className={`chat-tool${sure ? " danger" : ""}`}
          disabled={busy || (messages.length === 0 && conversations.length === 1)}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            onDelete();
          }}
        >
          {sure ? t("chat.deleteSure") : t("chat.delete")}
        </button>
        </div>
      </div>
      {(usedContext || shownLimits.length > 0) && (
        <div className="chat-usage">
          {usedContext && (
            <Meter
              label={t("chat.context")}
              percent={(usedContext.used / usedContext.window) * 100}
              title={t("chat.contextHint", { used: usedContext.used.toLocaleString(), window: usedContext.window.toLocaleString() })}
            />
          )}
          {shownLimits.map((l) => (
            <Meter
              key={l.label}
              label={l.label === "5h" ? t("chat.limit5h") : l.label === "weekly" ? t("chat.limitWeek") : l.label}
              percent={l.percent}
              title={l.resetsAt ? t("chat.resets", { when: new Date(l.resetsAt * 1000).toLocaleString() }) : t("chat.limit")}
            />
          ))}
        </div>
      )}
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
