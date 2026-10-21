import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { inTauri } from "./api";

/** What the app knows about Rhino and its plugin (see `rhino.rs`). */
export interface RhinoStatus {
  connected: boolean;
  host: string;
  port: number;
  error: string | null;
  /** The open document's file name, if it was saved. */
  document: string | null;
  units: string | null;
  /** Millimetres per model unit. */
  unitMm: number | null;
  objects: number | null;
}

export const RHINO_DEFAULT_HOST = "127.0.0.1";
export const RHINO_DEFAULT_PORT = 1999;

export const rhinoStatus = (force = false) => invoke<RhinoStatus>("rhino_status", { force });
export const rhinoConfigure = (host: string, port: number) => invoke<RhinoStatus>("rhino_configure", { host, port });

/** Whether the document in Rhino changed since the preview was made. */
export const rhinoChanged = () => invoke<boolean>("rhino_changed");

const POLL_MS = 4000;

/**
 * Whether Rhino is reachable, looked up every few seconds. `up` counts how many times it has come (back) up, so
 * that the preview can be made again when Rhino starts after the app.
 */
export function useRhinoStatus() {
  const [status, setStatus] = useState<RhinoStatus | null>(null);
  const [up, setUp] = useState(0);
  const was = useRef(false);

  const look = useCallback(async (force: boolean) => {
    if (!inTauri()) return;
    try {
      const s = await rhinoStatus(force);
      setStatus(s);
      if (s.connected && !was.current) setUp((n) => n + 1);
      was.current = s.connected;
    } catch {
      /* the app is closing */
    }
  }, []);

  useEffect(() => {
    void look(false);
    const id = setInterval(() => void look(false), POLL_MS);
    return () => clearInterval(id);
  }, [look]);

  return { status, up, recheck: () => look(true), set: setStatus };
}
