import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { inTauri } from "../api";

/** An agent that could answer in the chat panel. */
export interface EngineInfo {
  id: string;
  label: string;
  /** Installed and signed in on this computer. */
  available: boolean;
  /** Who is signed in, or what is missing. */
  detail: string;
}

export interface Reply {
  session: string | null;
  text: string;
  tools: string[];
  cancelled: boolean;
}

export type ChatEvent = { kind: "delta" | "tool"; text: string };

export async function listEngines(): Promise<EngineInfo[]> {
  if (!inTauri()) return [];
  try {
    return await invoke<EngineInfo[]>("chat_engines");
  } catch {
    return [];
  }
}

export const sendToEngine = (engineId: string, prompt: string, session: string | null) =>
  invoke<Reply>("chat_send", { engineId, prompt, session });

export const stopEngine = () => invoke("chat_cancel");

export const onChatEvent = (fn: (e: ChatEvent) => void) =>
  listen<ChatEvent>("chat-event", (e) => fn(e.payload));
