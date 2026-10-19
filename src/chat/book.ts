import type { ChatBook, ChatLog, ChatMessage } from "../types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const TITLE_LENGTH = 40;

export function freshLog(): ChatLog {
  return { id: crypto.randomUUID(), title: "", updated: Date.now(), messages: [] };
}

export function freshBook(): ChatBook {
  const log = freshLog();
  return { active: log.id, list: [log] };
}

/** What a conversation is called in the list: the start of the first question. */
export function titleOf(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.text.trim().replace(/\s+/g, " ") ?? "";
  return first.length > TITLE_LENGTH ? `${first.slice(0, TITLE_LENGTH - 1)}…` : first;
}

function readLog(v: unknown): ChatLog | null {
  if (!isObject(v) || typeof v.id !== "string" || !Array.isArray(v.messages)) return null;
  const messages = v.messages.filter(
    (m): m is ChatMessage => isObject(m) && typeof m.id === "string" && typeof m.text === "string" && typeof m.role === "string",
  );
  return {
    id: v.id,
    title: typeof v.title === "string" ? v.title : titleOf(messages),
    updated: typeof v.updated === "number" ? v.updated : 0,
    messages,
    session: isObject(v.session) && typeof v.session.engine === "string" && typeof v.session.id === "string" ? (v.session as ChatLog["session"]) : undefined,
    summary: typeof v.summary === "string" ? v.summary : undefined,
    autoCompact: v.autoCompact === true ? true : undefined,
  };
}

/** Reads a book from a file or from the app's store; anything else (an old file's `[]`) is an empty one. */
export function readBook(raw: unknown): ChatBook {
  if (!isObject(raw) || !Array.isArray(raw.list)) return freshBook();
  const list = raw.list.map(readLog).filter((l): l is ChatLog => l !== null);
  if (list.length === 0) return freshBook();
  return { active: list.some((l) => l.id === raw.active) ? (raw.active as string) : list[0].id, list };
}

/** Whether a conversation with auto-compact on has used up `at` (0 to 1) of the memory of the agent `engine`. */
export function needsAutoCompact(log: ChatLog | undefined, engine: string | null, at: number): boolean {
  const ctx = log?.context;
  return !!log?.autoCompact && !!ctx && ctx.engine === engine && ctx.window > 0 && ctx.used / ctx.window >= at;
}

/** A conversation as the .fc file keeps it: all of it, but for the agent's own session id, which means nothing on another computer. */
export const portableLog = (l: ChatLog): ChatLog => ({ ...l, session: undefined });

export const portableBook = (b: ChatBook): ChatBook => ({ active: b.active, list: b.list.map(portableLog) });

/**
 * The project's conversations together with the app's own copies of them. Both may know ones the
 * other does not; of the same one, the newer wins, and the app's (which has the details) on a tie.
 */
export function mergeBooks(project: ChatBook, kept: ChatBook | null): ChatBook {
  if (!kept) return project;
  const byId = new Map(project.list.map((l) => [l.id, l]));
  for (const k of kept.list) {
    const p = byId.get(k.id);
    if (!p || k.updated >= p.updated) byId.set(k.id, k);
  }
  const list = [...byId.values()].filter((l) => l.messages.length > 0 || byId.size === 1).sort((a, b) => a.updated - b.updated);
  if (list.length === 0) return freshBook();
  const active = byId.has(project.active) ? project.active : kept.active;
  return { active: list.some((l) => l.id === active) ? active : list[list.length - 1].id, list };
}
