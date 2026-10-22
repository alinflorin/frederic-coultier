import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Limit as ChatLimit, Attached, ChatBook, ChatLog, ChatMessage, FcProject, Step } from "../types";
import { inTauri } from "../api";
import { getPref, setPref } from "../prefs";
import { loadChat, onChatEvent, saveChat, sendToEngine, stopEngine, type ChatEvent } from "./engines";
import { freshBook, freshLog, needsAutoCompact, portableBook, mergeBooks, readBook, titleOf } from "./book";
import { COMPACT_PROMPT, lineChange, opening } from "./prompt";
import { chimeOn, chimeSecs, chimedSince, playChime } from "../chime";

/** A conversation with auto-compact on is compacted once its memory is this full (0 to 1). */
export const AUTO_COMPACT_AT = 0.8;

/** The answer being written right now. */
export interface Live {
  text: string;
  steps: Step[];
}

/** The answer being written, with one more thing the agent did. */
function stepped(l: Live, e: ChatEvent): Live {
  const last = l.steps[l.steps.length - 1];
  // text and thinking grow the step before them if it is of the same kind
  const grow = (type: "thought" | "text", more: string): Live => ({
    ...l,
    steps: last?.type === type ? [...l.steps.slice(0, -1), { type, text: last.text + more }] : [...l.steps, { type, text: more }],
  });
  if (e.kind === "delta") return { ...grow("text", e.text), text: l.text + e.text };
  if (e.kind === "thought") return grow("thought", e.text);
  if (e.kind === "tool") return { ...l, steps: [...l.steps, { type: "tool", call: e.call }] };
  return {
    ...l,
    steps: l.steps.map((s) =>
      s.type === "tool" && s.call.id === e.id ? { type: "tool", call: { ...s.call, output: e.output, error: e.error, done: true } } : s,
    ),
  };
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));
const id = () => crypto.randomUUID();

/**
 * The conversations with the agent: any number per project. The .fc file keeps all of them
 * (`onLite` hands it over to be saved with the project); the app keeps the full copy, filed under
 * the project's path. `engine` is the agent that answers; a conversation started with another
 * one is carried over as text.
 */
export function useAgentChat({
  projectRef,
  engine,
  model,
  effort,
  path,
  projectId,
  onLite,
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
  /** The conversations as the project file keeps them; called when they change. */
  onLite: (book: ChatBook) => void;
}) {
  const [book, setBook] = useState<ChatBook>(() => projectRef.current?.chats ?? freshBook());
  const bookRef = useRef(book);
  const pathRef = useRef(path);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const liteRef = useRef("");
  const onLiteRef = useRef(onLite);
  onLiteRef.current = onLite;

  const active = book.list.find((l) => l.id === book.active) ?? book.list[0];
  const log = active;
  const logRef = { get current() { return bookRef.current.list.find((l) => l.id === bookRef.current.active)!; } };

  /** Takes a new state of the book. `notify`: the project should hear of it (not for a book just loaded). */
  const store = useCallback((next: ChatBook, notify = true) => {
    bookRef.current = next;
    setBook(next);
    const lite = JSON.stringify(portableBook(next));
    if (notify && lite !== liteRef.current) onLiteRef.current(portableBook(next));
    liteRef.current = lite;
    clearTimeout(saveTimer.current);
    const key = pathRef.current;
    if (!key || !inTauri()) return;
    saveTimer.current = setTimeout(() => {
      saveChat(key, next.list.some((l) => l.messages.length) ? next : null).catch(() => {});
    }, 400);
  }, []);

  // another project: its conversations, and the app's fuller copies of them if it has any
  useEffect(() => {
    pathRef.current = path;
    clearTimeout(saveTimer.current);
    const mine = projectRef.current?.chats ?? freshBook();
    store(mine, false);
    if (!path || !inTauri()) return;
    let stale = false;
    loadChat(path).then(
      (v) => {
        if (stale || v == null || bookRef.current !== mine) return;
        store(mergeBooks(mine, readBook(v)), false);
      },
      () => {},
    );
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // saved under another name: the conversations go along
  useEffect(() => {
    if (pathRef.current === path) return;
    pathRef.current = path;
    store(bookRef.current, false);
  }, [path, store]);

  // the account's limits, as last reported by the agent in use; they only change when it answers
  type Limits = ChatLimit[];
  const [limits, setLimits] = useState<Limits>([]);
  useEffect(() => {
    setLimits(engine ? (getPref<Record<string, Limits>>("chatLimits") ?? {})[engine] ?? [] : []);
  }, [engine]);

  const [live, setLive] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<"answer" | "compact" | null>(null);
  const busy = useRef(false);

  // what the agent says, as it says it
  useEffect(() => {
    let off: (() => void) | undefined;
    let gone = false;
    onChatEvent((e) => {
      const l = liveRef.current;
      if (!l) return;
      liveRef.current = stepped(l, e);
      setLive(liveRef.current);
    }).then(
      (f) => (gone ? f() : (off = f)),
      () => {},
    );
    return () => {
      gone = true;
      off?.();
    };
  }, []);

  /** Changes the conversation on show. */
  const patch = useCallback(
    (fn: (c: ChatLog) => ChatLog) => {
      const b = bookRef.current;
      store({
        ...b,
        list: b.list.map((l) => {
          if (l.id !== b.active) return l;
          const next = fn(l);
          return { ...next, title: next.title || titleOf(next.messages), updated: Date.now() };
        }),
      });
    },
    [store],
  );
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
    liveRef.current = { text: "", steps: [] };
    setLive(liveRef.current);
    try {
      const r = await sendToEngine(engine!, prompt, session, model, effort, files);
      if (r.session) patch((c) => ({ ...c, session: { engine: engine!, id: r.session! } }));
      const u = r.usage;
      if (u?.contextUsed != null && kind === "answer") {
        const window = u.contextWindow ?? (logRef.current.context?.engine === engine ? logRef.current.context.window : 0);
        if (window > 0) patch((c) => ({ ...c, context: { engine: engine!, used: u.contextUsed!, window } }));
      }
      if (u?.limits?.length) {
        const next = { ...(getPref<Record<string, Limits>>("chatLimits") ?? {}), [engine!]: u.limits };
        setPref("chatLimits", next);
        setLimits(u.limits);
      }
      return { ...r, steps: liveRef.current?.steps ?? [] };
    } finally {
      busy.current = false;
      setWorking(null);
      liveRef.current = null;
      setLive(null);
    }
  }

  const send = async (text: string, files: Attached[] = []) => {
    const p = projectRef.current;
    if (!p || !engine || busy.current) return;
    const c = logRef.current;
    const known = c.session?.engine === engine;
    const prompt = known ? text : opening(text, c.summary, c.messages, p.settings.general.notes);
    add({ role: "user", text, files: files.length ? files : undefined });
    const before = p.source;
    const started = Date.now();
    const convo = bookRef.current.active;
    try {
      const r = await turn(prompt, "answer", files);
      if (!r.cancelled && chimeOn() && Date.now() - started >= chimeSecs() * 1000 && !chimedSince(started)) playChime();
      const change = lineChange(before, projectRef.current!.source);
      const changed = change.added + change.removed > 0;
      const said = r.cancelled ? `${r.text}${r.text ? "\n\n" : ""}…` : r.text;
      if (said || r.steps.length) {
        let steps = r.steps;
        // what the agent said is shown in its steps; a cancelled answer ends with the dots
        if (r.cancelled) {
          const last = steps[steps.length - 1];
          steps = last?.type === "text" ? [...steps.slice(0, -1), { type: "text", text: `${last.text}…` }] : [...steps, { type: "text", text: "…" }];
        } else if (r.text && !steps.some((s) => s.type === "text")) steps = [...steps, { type: "text", text: r.text }];
        add({ role: "assistant", text: said, steps: steps.length ? steps : undefined, change: changed ? change : undefined });
      }
      const log = bookRef.current.list.find((l) => l.id === convo);
      if (!r.cancelled && bookRef.current.active === convo && needsAutoCompact(log, engine, AUTO_COMPACT_AT)) await compact();
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
        context: undefined,
        messages: [...c.messages, { id: id(), role: "note", text: "compacted" }],
      }));
    } catch (e) {
      setError(errorText(e));
    }
  };

  /** Turns auto-compact on or off for the conversation on show only. */
  const setAutoCompact = (on: boolean) => patch((c) => ({ ...c, autoCompact: on || undefined }));

  const select = (id: string) => {
    if (busy.current || id === bookRef.current.active) return;
    setError(null);
    store({ ...bookRef.current, active: id });
  };

  /** A new conversation; the empty one already on show is reused. */
  const create = () => {
    if (busy.current || logRef.current.messages.length === 0) return;
    const fresh = freshLog();
    setError(null);
    store({ active: fresh.id, list: [...bookRef.current.list, fresh] });
  };

  /** Deletes the conversation on show; the last one is emptied instead. */
  const remove = () => {
    if (busy.current) return;
    setError(null);
    const b = bookRef.current;
    const rest = b.list.filter((l) => l.id !== b.active);
    if (rest.length === 0) return store(freshBook());
    store({ active: rest[rest.length - 1].id, list: rest });
  };

  const stop = () => {
    stopEngine().catch(() => {});
  };

  return { limits, book, log, live, error, working, send, compact, setAutoCompact, select, create, remove, stop };
}
