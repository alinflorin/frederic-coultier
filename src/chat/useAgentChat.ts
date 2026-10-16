import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ChatLog, ChatMessage, FcProject } from "../types";
import { onChatEvent, sendToEngine, stopEngine } from "./engines";
import { COMPACT_PROMPT, lineChange, opening } from "./prompt";

/** The answer being written right now. */
export interface Live {
  text: string;
  tools: string[];
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));
const id = () => crypto.randomUUID();

/**
 * The chat with the agent: one conversation per project, kept in the project. `engine` is the
 * agent that answers; a conversation started with another one is carried over as text.
 */
export function useAgentChat({
  projectRef,
  edit,
  engine,
}: {
  projectRef: MutableRefObject<FcProject | null>;
  edit: (fn: (p: FcProject) => FcProject) => void;
  engine: string | null;
}) {
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
        return e.kind === "delta" ? { ...l, text: l.text + e.text } : { ...l, tools: [...l.tools, e.text] };
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

  const patch = useCallback(
    (fn: (c: ChatLog) => ChatLog) => edit((p) => ({ ...p, chat: fn(p.chat) })),
    [edit],
  );
  const add = useCallback(
    (m: Omit<ChatMessage, "id">) => patch((c) => ({ ...c, messages: [...c.messages, { id: id(), ...m }] })),
    [patch],
  );

  /** Runs one turn against the agent; the caller decides what its text becomes. */
  async function turn(prompt: string, kind: "answer" | "compact") {
    const c = projectRef.current!.chat;
    const session = c.session?.engine === engine ? c.session.id : null;
    busy.current = true;
    setError(null);
    setWorking(kind);
    setLive({ text: "", tools: [] });
    try {
      const r = await sendToEngine(engine!, prompt, session);
      if (r.session) patch((c) => ({ ...c, session: { engine: engine!, id: r.session! } }));
      return r;
    } finally {
      busy.current = false;
      setWorking(null);
      setLive(null);
    }
  }

  const send = async (text: string) => {
    const p = projectRef.current;
    if (!p || !engine || busy.current) return;
    const known = p.chat.session?.engine === engine;
    const prompt = known ? text : opening(text, p.chat.summary, p.chat.messages);
    add({ role: "user", text });
    const before = p.source;
    try {
      const r = await turn(prompt, "answer");
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
    const c = projectRef.current?.chat;
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

  return { live, error, working, send, compact, clear, stop };
}
