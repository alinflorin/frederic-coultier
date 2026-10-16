import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Attached, ChatLog, ChatMessage, FcProject, ToolCall } from "../types";
import { inTauri } from "../api";
import { loadChat, onChatEvent, saveChat, sendToEngine, stopEngine } from "./engines";
import { COMPACT_PROMPT, lineChange, opening } from "./prompt";

/** The answer being written right now. */
export interface Live {
  text: string;
  tools: ToolCall[];
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));
const id = () => crypto.randomUUID();

const EMPTY: ChatLog = { messages: [] };

const isLog = (v: unknown): v is ChatLog =>
  typeof v === "object" && v !== null && Array.isArray((v as ChatLog).messages);

/**
 * The chat with the agent: one conversation per project file. It is kept by the app (filed under
 * the project's path), never inside the .fc file. `engine` is the agent that answers; a
 * conversation started with another one is carried over as text.
 */
export function useAgentChat({
  projectRef,
  engine,
  model,
  effort,
  path,
  projectId,
}: {
  projectRef: MutableRefObject<FcProject | null>;
  engine: string | null;
  /** Empty: the agent's own choice. */
  model: string;
  effort: string;
  /** Where the project lives on disk; null while it has never been saved. */
  path: string | null;
  /** Changes whenever a different project is loaded. */
  projectId: number;
}) {
  const [log, setLog] = useState<ChatLog>(EMPTY);
  const logRef = useRef<ChatLog>(EMPTY);
  const pathRef = useRef(path);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const store = useCallback((next: ChatLog) => {
    logRef.current = next;
    setLog(next);
    clearTimeout(saveTimer.current);
    const key = pathRef.current;
    if (!key || !inTauri()) return;
    saveTimer.current = setTimeout(() => {
      saveChat(key, next.messages.length ? next : null).catch(() => {});
    }, 400);
  }, []);

  // another project: its conversation, if it has one
  useEffect(() => {
    pathRef.current = path;
    store(EMPTY);
    clearTimeout(saveTimer.current);
    if (!path || !inTauri()) return;
    let stale = false;
    loadChat(path).then(
      (v) => {
        if (!stale && isLog(v) && logRef.current.messages.length === 0) {
          logRef.current = v;
          setLog(v);
        }
      },
      () => {},
    );
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // saved under another name: the conversation goes along
  useEffect(() => {
    if (pathRef.current === path) return;
    pathRef.current = path;
    store(logRef.current);
  }, [path, store]);

  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<"answer" | "compact" | null>(null);
  const busy = useRef(false);

  // what the agent says, as it says it
  useEffect(() => {
    let off: (() => void) | undefined;
    let gone = false;
    onChatEvent((e) => {
      setLive((l) => {
        if (!l) return l;
        if (e.kind === "delta") return { ...l, text: l.text + e.text };
        if (e.kind === "tool") return { ...l, tools: [...l.tools, e.call] };
        return {
          ...l,
          tools: l.tools.map((c) => (c.id === e.id ? { ...c, output: e.output, error: e.error, done: true } : c)),
        };
      });
    }).then(
      (f) => (gone ? f() : (off = f)),
      () => {},
    );
    return () => {
      gone = true;
      off?.();
    };
  }, []);

  const patch = useCallback((fn: (c: ChatLog) => ChatLog) => store(fn(logRef.current)), [store]);
  const add = useCallback(
    (m: Omit<ChatMessage, "id">) => patch((c) => ({ ...c, messages: [...c.messages, { id: id(), ...m }] })),
    [patch],
  );

  /** Runs one turn against the agent; the caller decides what its text becomes. */
  async function turn(prompt: string, kind: "answer" | "compact", files: Attached[] = []) {
    const c = logRef.current;
    const session = c.session?.engine === engine ? c.session.id : null;
    busy.current = true;
    setError(null);
    setWorking(kind);
    setLive({ text: "", tools: [] });
    try {
      const r = await sendToEngine(engine!, prompt, session, model, effort, files);
      if (r.session) patch((c) => ({ ...c, session: { engine: engine!, id: r.session! } }));
      return r;
    } finally {
      busy.current = false;
      setWorking(null);
      setLive(null);
    }
  }

  const send = async (text: string, files: Attached[] = []) => {
    const p = projectRef.current;
    if (!p || !engine || busy.current) return;
    const c = logRef.current;
    const known = c.session?.engine === engine;
    const prompt = known ? text : opening(text, c.summary, c.messages);
    // the saved conversation keeps pictures to show again, but not other files
    const kept = files.map((f) => (f.mime.startsWith("image/") ? f : { name: f.name, mime: f.mime }));
    add({ role: "user", text, files: kept.length ? kept : undefined });
    const before = p.source;
    try {
      const r = await turn(prompt, "answer", files);
      const change = lineChange(before, projectRef.current!.source);
      const changed = change.added + change.removed > 0;
      const said = r.cancelled ? `${r.text}${r.text ? "\n\n" : ""}…` : r.text;
      if (said || r.tools.length) {
        add({ role: "assistant", text: said, tools: r.tools.length ? r.tools : undefined, change: changed ? change : undefined });
      }
    } catch (e) {
      setError(errorText(e));
    }
  };

  /** Replaces the agent's memory of the conversation with a summary it writes itself. */
  const compact = async () => {
    const c = logRef.current;
    if (!engine || busy.current || !c?.session || c.session.engine !== engine) return;
    try {
      const r = await turn(COMPACT_PROMPT, "compact");
      if (r.cancelled || !r.text.trim()) return;
      patch((c) => ({
        ...c,
        summary: r.text.trim(),
        session: undefined,
        messages: [...c.messages, { id: id(), role: "note", text: "compacted" }],
      }));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const clear = () => {
    if (busy.current) return;
    setError(null);
    patch(() => ({ messages: [] }));
  };

  const stop = () => {
    stopEngine().catch(() => {});
  };

  return { log, live, error, working, send, compact, clear, stop };
}
