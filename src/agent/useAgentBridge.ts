import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { inTauri } from "../api";
import { handle, type AgentApi } from "./ops";

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));

/**
 * Answers the agent's requests: the Rust side (the MCP server) emits `agent:request`
 * and waits for `agent_reply`. `api` must stay the same object between renders.
 */
export function useAgentBridge(api: AgentApi) {
  useEffect(() => {
    if (!inTauri()) return;
    let off: (() => void) | undefined;
    let dead = false;
    listen<{ id: number; op: string; args: Record<string, unknown> | null }>("agent:request", async (e) => {
      const { id, op, args } = e.payload;
      try {
        const value = await handle(api, op, args ?? {});
        await invoke("agent_reply", { id, ok: true, value: value ?? null });
      } catch (err) {
        await invoke("agent_reply", { id, ok: false, value: errorText(err) });
      }
    }).then((u) => (dead ? u() : (off = u)));
    return () => {
      dead = true;
      off?.();
    };
  }, [api]);
}
