import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { inTauri } from "../api";

interface Status {
  running: boolean;
  url: string | null;
  error: string | null;
  client: string | null;
  idleSecs: number | null;
  calls: number;
}

/** An agent that did something this recently counts as working right now. */
const ACTIVE_SECS = 30;
const POLL_MS = 2500;

/** The state of the MCP server in the menu bar: off, waiting for an agent, or an agent at work. Opens the preferences. */
export function McpIndicator({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    if (!inTauri()) return;
    let alive = true;
    const poll = () => invoke<Status>("mcp_status").then((v) => alive && setS(v), () => {});
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!s) return null;
  const name = s.client ?? t("mcp.agent");
  const seen = s.idleSecs !== null;
  const active = s.running && seen && s.idleSecs! < ACTIVE_SECS;
  const state = !s.running ? (s.error ? "error" : "off") : active ? "active" : seen ? "idle" : "ready";
  const label = {
    off: t("mcp.off"),
    error: t("mcp.error"),
    ready: t("mcp.ready"),
    idle: t("mcp.idle", { name }),
    active: t("mcp.active", { name }),
  }[state];
  const detail = !s.running
    ? [t("mcp.offTitle"), s.error].filter(Boolean).join(" ")
    : [s.url, seen ? t("mcp.last", { name, calls: s.calls, secs: s.idleSecs }) : t("mcp.none")].join("\n");
  const title = `${t("mcp.about")}\n\n${detail}`;

  return (
    <button type="button" className={`mcp-pill ${state}`} title={title} onClick={onClick}>
      <span className="mcp-dot" aria-hidden />
      <span className="mcp-pill-text">{label}</span>
    </button>
  );
}
