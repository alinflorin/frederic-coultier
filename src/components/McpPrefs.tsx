import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActionIcon, Button, Code, Group, Indicator, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { inTauri } from "../api";
import { getPref, setPref } from "../prefs";
import { Icon } from "./Icon";
import { mcpSchema } from "../validation";
import { TextField } from "./form";

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
    <Button
      type="button"
      variant="default"
      size="compact-sm"
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
    </Button>
  );
}

/** A command in a scrolling box. */
function Command({ children }: { children: string }) {
  return <Code flex={1} fz={12} p="6px 8px" bd="1px solid var(--border)" bg="var(--code-bg)" style={{ minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", borderRadius: 6 }}>{children}</Code>;
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
    <Stack gap={2} my={8}>
      <Text fw={600} fz={13}>{agent.name}</Text>
      {agent.supported ? (
        <Group gap={8} my={4} wrap="nowrap">
          <Command>{agent.command ?? t("prefs.mcp.needsServer")}</Command>
          <ActionIcon
            variant="subtle"
            color="gray"
            title={t("prefs.mcp.run", { name: agent.name })}
            aria-label={t("prefs.mcp.run", { name: agent.name })}
            disabled={!agent.command || state === "running"}
            onClick={run}
          >
            <Icon name="play" />
          </ActionIcon>
          {agent.command && <Copy text={agent.command} label={t("prefs.mcp.copy")} />}
        </Group>
      ) : null}
      {agent.note && <Text fz={12} c={agent.supported ? "dimmed" : "var(--accent)"} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{agent.note}</Text>}
      {state === "running" && <Text fz={12} c="dimmed">{t("prefs.mcp.running_cmd")}</Text>}
      {state && state !== "running" && <Text fz={12} c={state.ok ? "var(--ok)" : "var(--bad)"}>{state.text}</Text>}
    </Stack>
  );
}

/** Host and port of the MCP server that agents connect to, and whether it is running. */
export function McpPrefs() {
  const { t } = useTranslation();
  const schema = useMemo(() => mcpSchema(t), [t]);
  // a message shows under a field once it was touched and left
  const form = useForm<{ host: string; port: string }>({
    defaultValues: { host: getPref<string>("mcpHost") || MCP_DEFAULT_HOST, port: String(getPref<number>("mcpPort") || MCP_DEFAULT_PORT) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    mode: "onTouched",
  });
  const { host, port } = useWatch({ control: form.control }) as { host: string; port: string };
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

  if (!inTauri()) return <Text fz={12} c="dimmed" mt={6}>{t("prefs.mcp.desktopOnly")}</Text>;

  const valid = schema.safeParse({ host, port }).success;
  const portNumber = Number(port.trim());
  const exposed = /^[A-Za-z0-9.:-]+$/.test(host.trim()) && !LOCAL.has(host.trim().toLowerCase());
  const changed = !status || status.host !== host.trim() || status.port !== portNumber;

  const apply = form.handleSubmit(async (v) => {
    const h = v.host.trim();
    const p = Number(v.port.trim());
    setBusy(true);
    setProblem(null);
    setPref("mcpHost", h);
    setPref("mcpPort", p);
    try {
      setStatus(await invoke<McpStatus>("mcp_configure", { host: h, port: p }));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  });

  const url = status?.url ?? null;

  return (
    <>
      <Text fz={12} c="dimmed" mt={6}>{t("prefs.mcp.intro")}</Text>
      <TextField control={form.control} name="host" label={t("prefs.mcp.host")} />
      <TextField control={form.control} name="port" label={t("prefs.mcp.port")} />
      {exposed && <Text fz={12} c="var(--accent)">{t("prefs.mcp.exposed")}</Text>}
      <Group gap={8} mt={8} mb={4}>
        <Button disabled={busy || !valid || !changed} onClick={apply}>
          {busy ? t("prefs.mcp.applying") : t("prefs.mcp.apply")}
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={busy || (host === MCP_DEFAULT_HOST && port === String(MCP_DEFAULT_PORT))}
          onClick={() => form.reset({ host: MCP_DEFAULT_HOST, port: String(MCP_DEFAULT_PORT) })}
        >
          {t("prefs.mcp.defaults")}
        </Button>
      </Group>

      <Group gap={6} mt={10} mb={6} fz={13} role="status">
        {problem ? (
          <Text span inherit c="var(--bad)">{problem}</Text>
        ) : status?.running ? (
          <>
            <Indicator inline size={9} color="var(--ok)" withBorder={false} offset={0} position="middle-center"><span style={{ display: "block", width: 9, height: 9 }} /></Indicator> {t("prefs.mcp.running")}
          </>
        ) : status ? (
          <>
            <Indicator inline size={9} color="var(--muted)" withBorder={false} offset={0} position="middle-center"><span style={{ display: "block", width: 9, height: 9 }} /></Indicator> {t("prefs.mcp.stopped")}
            {status.error && <Text span inherit c="var(--bad)"> {status.error}</Text>}
          </>
        ) : null}
      </Group>

      {url && (
        <Group gap={8} my={4} wrap="nowrap">
          <Command>{url}</Command>
          <Copy text={url} label={t("prefs.mcp.copy")} />
        </Group>
      )}
      <Title order={5} fz={14} mt={14} mb={2}>{t("prefs.mcp.agents")}</Title>
      <Text fz={12} c="dimmed" mt={6}>{t("prefs.mcp.connect")}</Text>
      {agents.map((a) => (
        <AgentRow key={`${a.id}${a.command}`} agent={a} onRun={(id) => invoke<string>("mcp_connect", { id })} />
      ))}
      {status?.running && status.loopback && <Text fz={12} c="dimmed" mt={6}>{t("prefs.mcp.local")}</Text>}
    </>
  );
}
