import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { inTauri } from "../api";
import type { Attached, Limit, ToolCall, ToolPart } from "../types";

/** An agent that could answer in the chat panel. */
export interface EngineInfo {
  id: string;
  label: string;
  /** Installed and signed in on this computer. */
  available: boolean;
  /** Who is signed in, or what is missing. */
  detail: string;
  models: ModelInfo[];
  /** The thinking levels of the agent's own default model. */
  efforts: string[];
}

export interface ModelInfo {
  id: string;
  label: string;
  /** Lowest first; empty if the model has no such setting. */
  efforts: string[];
}

export interface Usage {
  contextUsed: number | null;
  contextWindow: number | null;
  limits: Limit[];
}

export interface Reply {
  usage: Usage;
  session: string | null;
  text: string;
  thinking: string;
  tools: ToolCall[];
  cancelled: boolean;
}

export type ChatEvent =
  | { kind: "delta"; text: string }
  | { kind: "thought"; text: string }
  | { kind: "tool"; call: ToolCall }
  | { kind: "toolDone"; id: string; output: ToolPart[]; error: boolean };

export async function listEngines(): Promise<EngineInfo[]> {
  if (!inTauri()) return [];
  try {
    return await invoke<EngineInfo[]>("chat_engines");
  } catch {
    return [];
  }
}

export const sendToEngine = (
  engineId: string,
  prompt: string,
  session: string | null,
  model: string,
  effort: string,
  files: Attached[] = [],
) => invoke<Reply>("chat_send", { engineId, prompt, files, session, model, effort });

export const stopEngine = () => invoke("chat_cancel");

export const onChatEvent = (fn: (e: ChatEvent) => void) =>
  listen<ChatEvent>("chat-event", (e) => fn(e.payload));

/** The saved conversation about the project at `key` (its path). */
export const loadChat = (key: string) => invoke<unknown>("chat_load", { key });

/** Keeps it with the app; `null` forgets it. */
export const saveChat = (key: string, log: unknown) => invoke("chat_save", { key, log });
