import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { inTauri } from "../api";
import { getPref, setPref } from "../prefs";
import { Icon } from "./Icon";

export const MCP_DEFAULT_HOST = "127.0.0.1";
export const MCP_DEFAULT_PORT = 45555;

interface McpStatus {
  running: boolean;
  host: string;
  port: number;
  url: string | null;
  error: string | null;
  /** Only programs on this computer can connect. */
  loopback: boolean;
}

const LOCAL = new Set(["127.0.0.1", "localhost", "::1"]);
const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {},
        );
      }}
    >
      {done ? "✓" : label}
    </button>
  );
}

interface AgentInfo {
  id: string;
  name: string;
  command: string | null;
  note: string | null;
  supported: boolean;
}

/** One agent: the command that sets it up, a play button that runs it, and what came of it. */
function AgentRow({ agent, onRun }: { agent: AgentInfo; onRun: (id: string) => Promise<string> }) {
  const { t } = useTranslation();
  const [state, setState] = useState<{ ok: boolean; text: string } | "running" | null>(null);
  const run = async () => {
    setState("running");
    try {
      setState({ ok: true, text: await onRun(agent.id) });
    } catch (e) {
      setState({ ok: false, text: errorText(e) });
    }
  };
  return (
    <div className="mcp-agent">
      <div className="mcp-agent-name">{agent.name}</div>
      {agent.supported ? (
        <div className="mcp-copy">
          <code>{agent.command ?? t("prefs.mcp.needsServer")}</code>
          <button
            type="button"
            className="icon-btn"
            title={t("prefs.mcp.run", { name: agent.name })}
            aria-label={t("prefs.mcp.run", { name: agent.name })}
            disabled={!agent.command || state === "running"}
            onClick={run}
          >
            <Icon name="play" />
          </button>
          {agent.command && <Copy text={agent.command} label={t("prefs.mcp.copy")} />}
        </div>
      ) : null}
      {agent.note && <p className={agent.supported ? "muted note" : "note mcp-warn"}>{agent.note}</p>}
      {state === "running" && <p className="muted note">{t("prefs.mcp.running_cmd")}</p>}
      {state && state !== "running" && <p className={`note ${state.ok ? "mcp-ok" : "mcp-bad"}`}>{state.text}</p>}
    </div>
  );
}

/** Host and port of the MCP server that agents connect to, and whether it is running. */
export function McpPrefs() {
  const { t } = useTranslation();
  const [host, setHost] = useState(() => getPref<string>("mcpHost") || MCP_DEFAULT_HOST);
  const [port, setPort] = useState(() => String(getPref<number>("mcpPort") || MCP_DEFAULT_PORT));
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const runningUrl = status?.url ?? null;

  useEffect(() => {
    if (!inTauri()) return;
    invoke<AgentInfo[]>("mcp_agents").then(setAgents, () => setAgents([]));
  }, [runningUrl]);

  useEffect(() => {
    if (!inTauri()) return;
    invoke<McpStatus>("mcp_status").then(setStatus, (e) => setProblem(errorText(e)));
  }, []);

  if (!inTauri()) return <p className="muted note">{t("prefs.mcp.desktopOnly")}</p>;

  const portNumber = /^\d+$/.test(port.trim()) ? Number(port.trim()) : NaN;
  const hostOk = /^[A-Za-z0-9.:-]+$/.test(host.trim());
  const portOk = Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535;
  const exposed = hostOk && !LOCAL.has(host.trim().toLowerCase());
  const changed = !status || status.host !== host.trim() || status.port !== portNumber;

  async function apply() {
    if (!hostOk || !portOk) return;
    setBusy(true);
    setProblem(null);
    setPref("mcpHost", host.trim());
    setPref("mcpPort", portNumber);
    try {
      setStatus(await invoke<McpStatus>("mcp_configure", { host: host.trim(), port: portNumber }));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const url = status?.url ?? null;

  return (
    <>
      <p className="muted note">{t("prefs.mcp.intro")}</p>
      <label className="field">
        <span className="field-label">{t("prefs.mcp.host")}</span>
        <span className="field-input">
          <input type="text" value={host} spellCheck={false} aria-invalid={!hostOk} onChange={(e) => setHost(e.currentTarget.value)} />
        </span>
      </label>
      <label className="field">
        <span className="field-label">{t("prefs.mcp.port")}</span>
        <span className="field-input">
          <input type="text" inputMode="numeric" value={port} spellCheck={false} aria-invalid={!portOk} onChange={(e) => setPort(e.currentTarget.value)} />
        </span>
      </label>
      {(!hostOk || !portOk) && <p className="note mcp-bad">{!hostOk ? t("prefs.mcp.badHost") : t("prefs.mcp.badPort")}</p>}
      {exposed && <p className="note mcp-warn">{t("prefs.mcp.exposed")}</p>}
      <div className="mcp-actions">
        <button className="primary" disabled={busy || !hostOk || !portOk || !changed} onClick={apply}>
          {busy ? t("prefs.mcp.applying") : t("prefs.mcp.apply")}
        </button>
        <button
          type="button"
          disabled={busy || (host === MCP_DEFAULT_HOST && port === String(MCP_DEFAULT_PORT))}
          onClick={() => {
            setHost(MCP_DEFAULT_HOST);
            setPort(String(MCP_DEFAULT_PORT));
          }}
        >
          {t("prefs.mcp.defaults")}
        </button>
      </div>

      <div className="mcp-status" role="status">
        {problem ? (
          <span className="mcp-bad">{problem}</span>
        ) : status?.running ? (
          <>
            <span className="mcp-dot on" aria-hidden /> {t("prefs.mcp.running")}
          </>
        ) : status ? (
          <>
            <span className="mcp-dot" aria-hidden /> {t("prefs.mcp.stopped")}
            {status.error && <span className="mcp-bad"> {status.error}</span>}
          </>
        ) : null}
      </div>

      {url && (
        <>
          <div className="mcp-copy">
            <code>{url}</code>
            <Copy text={url} label={t("prefs.mcp.copy")} />
          </div>
        </>
      )}
      <h4 className="mcp-sub">{t("prefs.mcp.agents")}</h4>
      <p className="muted note">{t("prefs.mcp.connect")}</p>
      {agents.map((a) => (
        <AgentRow key={`${a.id}${a.command}`} agent={a} onRun={(id) => invoke<string>("mcp_connect", { id })} />
      ))}
      {status?.running && status.loopback && <p className="muted note">{t("prefs.mcp.local")}</p>}
    </>
  );
}
