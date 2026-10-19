import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Box, Button, Checkbox, CloseButton, Collapse, Group, Image, Indicator, Loader, NativeSelect, Progress, Stack, Text, Textarea, Title, Typography, UnstyledButton, type BoxProps } from "@mantine/core";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EngineInfo, ModelInfo } from "../chat/engines";
import type { Live } from "../chat/useAgentChat";
import type { Attached, ChatLog, Limit, ChatMessage, ToolCall } from "../types";
import { Icon } from "./Icon";
import { setChimeOn, useChime } from "../chime";
import { AUTO_COMPACT_AT } from "../chat/useAgentChat";

/** The agent's words, with their Markdown shown; links open outside the app. */
function Say({ text }: { text: string }) {
  return (
    <Typography fz="inherit" style={{ overflowWrap: "anywhere", maxWidth: "100%" }}>
      <Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>
        {text}
      </Markdown>
    </Typography>
  );
}

/** A heading that folds its content up until clicked. */
function Fold({ head, open, children, ...rest }: { head: ReactNode; open?: boolean; children: ReactNode } & BoxProps) {
  const [shown, setShown] = useState(!!open);
  useEffect(() => setShown(!!open), [open]);
  return (
    <Box {...rest}>
      <UnstyledButton onClick={() => setShown((v) => !v)} aria-expanded={shown} style={{ display: "flex", gap: 8, alignItems: "baseline", minWidth: 0, width: "100%", textAlign: "left" }}>
        <Text span inherit style={{ flex: "none" }}>{shown ? "▾" : "▸"}</Text>
        {head}
      </UnstyledButton>
      <Collapse expanded={shown}>{children}</Collapse>
    </Box>
  );
}

/** What the agent thought, folded up until clicked (open while it is still thinking). */
function Thought({ text, open }: { text: string; open?: boolean }) {
  const { t } = useTranslation();
  const body = text.trim();
  if (!body) return null;
  return (
    <Fold mb={8} fz={12} c="dimmed" open={open} head={<span>{t("chat.thoughts")}</span>}>
      <Box mt={4} pl={10} fs="italic" bd="0 solid var(--border)" style={{ borderLeftWidth: 2, maxHeight: 240, overflow: "auto" }}>
        <Say text={body} />
      </Box>
    </Fold>
  );
}

/** The tool calls of one answer, each folded up until clicked: what was asked, what came back, pictures included. */
function Tools({ tools }: { tools: ToolCall[] }) {
  const { t } = useTranslation();
  const out = { margin: 0, padding: "6px 8px", fontSize: 11.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 260, overflow: "auto", borderTop: "1px solid var(--border)" } as const;
  return (
    <Stack gap={4} mt={8} fz={12} style={{ minWidth: 0, whiteSpace: "normal" }}>
      {tools.map((c, i) => (
        <Fold
          key={c.id || i}
          bg="var(--surface)"
          bd="1px solid var(--border)"
          style={{ minWidth: 0, overflow: "hidden", borderRadius: 8 }}
          head={
            <>
              <Text span inherit ff="monospace" fw={600} c={c.error ? "var(--bad)" : undefined} style={{ flex: "none" }}>{c.name}</Text>
              {c.input && <Text span inherit ff="monospace" c="dimmed" truncate="end" style={{ minWidth: 0 }}>{c.input.split("\n")[0]}</Text>}
              {!c.done && <Text span inherit c="dimmed">…</Text>}
            </>
          }
        >
          {c.input && <Box component="pre" bg="var(--surface-2)" style={out}>{c.input}</Box>}
          {c.output.map((p, j) =>
            p.type === "text" ? (
              <Box component="pre" key={j} style={out}>{p.text}</Box>
            ) : (
              <Image key={j} alt={t("chat.picture")} src={`data:${p.mime};base64,${p.data}`} bd="0 solid var(--border)" style={{ borderTopWidth: 1, borderRadius: "0 0 8px 8px", maxWidth: "100%", height: "auto" }} />
            ),
          )}
        </Fold>
      ))}
    </Stack>
  );
}

const MAX_FILE = 15_000_000;

const readFile = (f: File) =>
  new Promise<Attached>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const url = String(r.result);
      resolve({ name: f.name || "image", mime: f.type, data: url.slice(url.indexOf(",") + 1) });
    };
    r.readAsDataURL(f);
  });

/** What was attached to a message: pictures as thumbnails, other files as names. */
function Files({ files, onRemove }: { files: Attached[]; onRemove?: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <Group gap={6}>
      {files.map((f, i) => (
        <Group key={i} gap={5} wrap="nowrap" px={6} py={2} fz={12} maw={160} bd="1px solid var(--border)" title={f.name} style={{ borderRadius: 6, display: "inline-flex" }}>
          {f.data && f.mime.startsWith("image/") ? (
            <Image alt={f.name} src={`data:${f.mime};base64,${f.data}`} w={28} h={28} radius={3} fit="cover" />
          ) : (
            <Icon name="code" size={13} />
          )}
          <Text span inherit truncate="end">{f.name}</Text>
          {onRemove && (
            <CloseButton size="xs" aria-label={t("chat.remove")} title={t("chat.remove")} onClick={() => onRemove(i)} />
          )}
        </Group>
      ))}
    </Group>
  );
}

/** A small bar with a number: how much of something is used up. */
function Meter({ label, percent, title }: { label: string; percent: number; title: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <Group gap={5} wrap="nowrap" title={title}>
      <span>{label}</span>
      <Progress w={56} size={5} value={p} color={p >= 95 ? "var(--bad)" : p >= 80 ? "#d9a400" : "var(--accent)"} />
      <span>{Math.round(percent)}%</span>
    </Group>
  );
}

export function ChatPane({
  conversations,
  activeId,
  messages,
  live,
  working,
  error,
  agent,
  engines,
  engineId,
  onEngine,
  context,
  limits,
  unavailable,
  canCompact,
  autoCompact,
  onAutoCompact,
  models,
  model,
  modelDefault,
  effortDefault,
  efforts,
  effort,
  onModel,
  onEffort,
  pdf,
  files,
  setFiles,
  onSend,
  onStop,
  onCompact,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ChatLog[];
  activeId: string;
  messages: ChatMessage[];
  live: Live | null;
  working: "answer" | "compact" | null;
  error: string | null;
  /** Who answers, e.g. "Claude". */
  agent: string | null;
  /** Every agent the app knows, usable or not. */
  engines: EngineInfo[];
  engineId: string;
  /** Switches the agent for the whole app, not just this project. */
  onEngine: (id: string) => void;
  /** How full the conversation is, if the agent said. */
  context?: ChatLog["context"];
  /** The account's plan limits, if the agent said. */
  limits: Limit[];
  /** Why nobody can answer, if so. */
  unavailable: string | null;
  canCompact: boolean;
  /** Whether this conversation compacts itself when its memory fills up. */
  autoCompact: boolean;
  onAutoCompact: (on: boolean) => void;
  models: ModelInfo[];
  /** The picked model, "" for the agent's own choice. */
  model: string;
  /** Name of the model Preferences picked, "" if it leaves the choice to the agent. */
  modelDefault: string;
  /** Likewise for the thinking level that applies to the model on show. */
  effortDefault: string;
  efforts: string[];
  effort: string;
  onModel: (id: string) => void;
  onEffort: (level: string) => void;
  /** Whether the agent can read PDF files. */
  pdf: boolean;
  /** What is attached to the message being written (kept by the app, so the preview can add to it). */
  files: Attached[];
  setFiles: Dispatch<SetStateAction<Attached[]>>;
  onSend: (text: string, files?: Attached[]) => void;
  onStop: () => void;
  onCompact: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [sure, setSure] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chime = useChime();
  const busy = working !== null;
  const state = unavailable ? "unavailable" : working === "compact" ? "compacting" : working ? "working" : error ? "error" : "idle";
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, live, error]);
  useEffect(() => {
    if (!sure) return;
    const timer = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(timer);
  }, [sure]);

  function submit() {
    const text = draft.trim();
    if ((!text && files.length === 0) || busy || unavailable) return;
    onSend(text || files.map((f) => f.name).join(", "), files);
    setDraft("");
    setFiles([]);
    setProblem(null);
  }

  async function attach(list: File[]) {
    const ok: File[] = [];
    let bad: string | null = null;
    for (const f of list) {
      if (f.size > MAX_FILE) bad = t("chat.tooBig", { name: f.name });
      else if (f.type === "application/pdf" && !pdf) bad = t("chat.noPdf", { agent: agent ?? "" });
      else ok.push(f);
    }
    setProblem(bad);
    try {
      const read = await Promise.all(ok.map(readFile));
      setFiles((cur) => [...cur, ...read]);
    } catch {
      setProblem(t("chat.attach"));
    }
  }

  const usedContext = context && context.engine === engineId && context.window > 0 ? context : null;
  // a window that has started over since the agent last said is no use
  const shownLimits = limits.filter((l) => !l.resetsAt || l.resetsAt * 1000 > Date.now());

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3")];

  const pick = (value: string, onChange: (v: string) => void, data: { value: string; label: string; disabled?: boolean }[], label: string, extra: object = {}) => (
    <NativeSelect size="xs" aria-label={label} title={label} value={value} disabled={busy} data={data} onChange={(e) => onChange(e.currentTarget.value)} style={{ maxWidth: 210, minWidth: 0 }} {...extra} />
  );
  const stateColor = state === "error" || state === "unavailable" ? "var(--bad)" : state === "idle" ? "var(--ok)" : "var(--accent)";
  const bar = { px: 10, py: 6, gap: 6, wrap: "nowrap", style: { flex: "none" } } as const;
  const bubbleBase = { maw: "88%", px: 12, py: 9, style: { minWidth: 0, borderRadius: 14, overflowWrap: "anywhere", wordBreak: "break-word" } } as const;

  return (
    <Stack component="section" gap={0} bg="var(--surface)" aria-label={t("chat.title")} style={{ minWidth: 0, minHeight: 0 }}>
      <Box bd="0 solid var(--border)" style={{ flex: "none", borderBottomWidth: 1 }}>
        <Group {...bar}>
          <Group gap={6} wrap="nowrap" fz={12} c="dimmed">
            <Icon name="sparkle" size={14} />
            {engines.length > 1 && engineId
              ? pick(engineId, onEngine, engines.map((e) => ({ value: e.id, label: e.label, disabled: !e.available })), t("chat.agent"))
              : (agent ?? t("chat.title"))}
          </Group>
          <Group gap={5} wrap="nowrap" fz={12} c={state === "idle" ? "dimmed" : stateColor === "var(--accent)" ? "var(--text)" : stateColor} role="status" title={error ?? unavailable ?? undefined} style={{ whiteSpace: "nowrap" }}>
            <Indicator inline size={8} color={stateColor} processing={state === "working" || state === "compacting"} offset={0} position="middle-center" withBorder={false}>
              <span style={{ display: "block", width: 8, height: 8 }} />
            </Indicator>
            {t(`chat.state.${state}`)}
          </Group>
          <Box flex={1} />
          {models.length > 0 &&
            pick(model, onModel, [{ value: "", label: modelDefault ? t("chat.defaultNamed", { name: modelDefault }) : t("chat.default") }, ...models.map((m) => ({ value: m.id, label: m.label }))], t("chat.model"))}
          {efforts.length > 0 &&
            pick(effort, onEffort, [{ value: "", label: effortDefault ? t("chat.defaultNamed", { name: effortDefault }) : t("chat.effortDefault") }, ...efforts.map((l) => ({ value: l, label: l }))], t("chat.effort"))}
        </Group>
        <Group {...bar} pt={0}>
          {pick(activeId, onSelect, conversations.map((c) => ({ value: c.id, label: c.title || t("chat.untitled") })), t("chat.conversation"), { style: { flex: "1 1 0", minWidth: 0 } })}
          <Button size="compact-xs" variant="default" fw={400} disabled={busy || messages.length === 0} onClick={onNew} title={t("chat.new")}>
            +
          </Button>
          <Button size="compact-xs" variant="default" fw={400} disabled={busy || !canCompact} onClick={onCompact} title={t("chat.compactHint")}>
            {t("chat.compact")}
          </Button>
          <Checkbox
            size="xs"
            label={t("chat.autoCompact")}
            title={t("chat.autoCompactHint", { percent: Math.round(AUTO_COMPACT_AT * 100) })}
            checked={autoCompact}
            onChange={(e) => onAutoCompact(e.currentTarget.checked)}
            styles={{ label: { whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 } }}
          />
          <Button
            size="compact-xs"
            variant="default"
            fw={400}
            c={sure ? "var(--bad)" : undefined}
            bd={sure ? "1px solid var(--bad)" : undefined}
            disabled={busy || (messages.length === 0 && conversations.length === 1)}
            onClick={() => {
              if (!sure) return setSure(true);
              setSure(false);
              onDelete();
            }}
          >
            {sure ? t("chat.deleteSure") : t("chat.delete")}
          </Button>
        </Group>
      </Box>
      {(usedContext || shownLimits.length > 0) && (
        <Group gap="4px 14px" px={10} py={5} fz={12} c="dimmed" bd="0 solid var(--border)" style={{ flex: "none", borderBottomWidth: 1 }}>
          {usedContext && (
            <Meter
              label={t("chat.context")}
              percent={(usedContext.used / usedContext.window) * 100}
              title={t("chat.contextHint", { used: usedContext.used.toLocaleString(), window: usedContext.window.toLocaleString() })}
            />
          )}
          {shownLimits.map((l) => (
            <Meter
              key={l.label}
              label={l.label === "5h" ? t("chat.limit5h") : l.label === "weekly" ? t("chat.limitWeek") : l.label}
              percent={l.percent}
              title={l.resetsAt ? t("chat.resets", { when: new Date(l.resetsAt * 1000).toLocaleString() }) : t("chat.limit")}
            />
          ))}
        </Group>
      )}
      <Stack gap={10} p={14} role="log" aria-live="polite" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {messages.length === 0 && !live && (
          <Stack align="center" gap="xs" m="auto" maw={360} ta="center" c="var(--accent)">
            <Icon name="sparkle" size={28} />
            <Title order={3} fz={17} c="var(--text)">{t("chat.emptyTitle")}</Title>
            <Text c="dimmed">{t("chat.emptyHint")}</Text>
            {!unavailable && (
              <Stack gap={6} mt={10} w="100%">
                {suggestions.map((s) => (
                  <Button key={s} variant="default" radius="xl" h="auto" py={6} styles={{ label: { whiteSpace: "normal" } }} onClick={() => onSend(s)} disabled={busy}>
                    {s}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        )}
        {messages.map((m) =>
          m.role === "note" ? (
            <Text key={m.id} fz={12} c="dimmed" px={10} py={2} bg="var(--surface-2)" style={{ alignSelf: "center", borderRadius: 999 }}>
              {m.text === "compacted" ? t("chat.compacted") : m.text}
            </Text>
          ) : (
            <Group key={m.id} wrap="nowrap" justify={m.role === "user" ? "flex-end" : "flex-start"} style={{ minWidth: 0 }}>
              <Box
                {...bubbleBase}
                bg={m.role === "user" ? "var(--accent)" : "var(--surface-2)"}
                c={m.role === "user" ? "var(--accent-text)" : undefined}
                style={{ ...bubbleBase.style, whiteSpace: m.role === "user" ? "pre-wrap" : "normal", borderBottomRightRadius: m.role === "user" ? 4 : 14, borderBottomLeftRadius: m.role === "user" ? 14 : 4 }}
              >
                {m.files && m.files.length > 0 && <Box mb={6}><Files files={m.files} /></Box>}
                {m.thinking && <Thought text={m.thinking} />}
                {m.role === "assistant" ? m.text && <Say text={m.text} /> : m.text}
                {m.tools && <Tools tools={m.tools.filter((c) => typeof c === "object")} />}
                {m.change && (
                  <Group gap={6} mt={8} px={8} py={4} fz={12} ff="monospace" bg="var(--surface)" bd="1px solid var(--border)" w="fit-content" wrap="nowrap" style={{ borderRadius: 6 }}>
                    <Icon name="code" size={13} /> model.scad
                    <Text span inherit c="var(--ok)">+{m.change.added}</Text>
                    <Text span inherit c="var(--bad)">−{m.change.removed}</Text>
                  </Group>
                )}
              </Box>
            </Group>
          ),
        )}
        {live && (
          <Group wrap="nowrap" style={{ minWidth: 0 }}>
            {working === "compact" ? (
              <Text fz={12} c="dimmed" px={10} py={2} bg="var(--surface-2)" style={{ alignSelf: "center", borderRadius: 999 }}>{t("chat.compacting")}</Text>
            ) : (
              <Box {...bubbleBase} bg="var(--surface-2)" aria-label={t("chat.thinking")} style={{ ...bubbleBase.style, borderBottomLeftRadius: 4 }}>
                {live.thinking.trim() && <Thought text={live.thinking} open={!live.text} />}
                {live.text ? <Say text={live.text} /> : !live.thinking.trim() && <Loader type="dots" size="sm" color="dimmed" />}
                {live.tools.length > 0 && <Tools tools={live.tools} />}
              </Box>
            )}
          </Group>
        )}
        {error && <Text role="alert" fz={13} c="var(--bad)" px={10} py={8} bg="var(--surface-2)" style={{ borderRadius: 8, overflowWrap: "anywhere" }}>{error}</Text>}
        <div ref={endRef} />
      </Stack>
      {unavailable && <Text fz={13} c="var(--bad)" mx={10} my={6} px={10} py={8} bg="var(--surface-2)" style={{ borderRadius: 8, overflowWrap: "anywhere" }}>{unavailable}</Text>}
      <Stack
        component="form"
        gap={6}
        p={10}
        bd="0 solid var(--border)"
        style={{ flex: "none", borderTopWidth: 1, outline: over ? "2px dashed var(--accent)" : undefined, outlineOffset: -4 }}
        onDragOver={(e) => {
          if (unavailable || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          if (unavailable || e.dataTransfer.files.length === 0) return;
          e.preventDefault();
          attach([...e.dataTransfer.files]);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {files.length > 0 && <Files files={files} onRemove={(i) => setFiles((cur) => cur.filter((_, j) => j !== i))} />}
        {problem && <Text fz={13} c="var(--bad)" px={10} py={8} bg="var(--surface-2)" style={{ borderRadius: 8, overflowWrap: "anywhere" }}>{problem}</Text>}
        <Checkbox
          size="xs"
          label={t("chat.chime")}
          title={t("chat.chimeHint", { secs: chime.secs })}
          checked={chime.on}
          onChange={(e) => setChimeOn(e.currentTarget.checked)}
          styles={{ label: { color: "var(--muted)", fontSize: 12 } }}
        />
        <Textarea
          value={draft}
          autosize
          minRows={2}
          maxRows={6}
          disabled={!!unavailable}
          placeholder={t("chat.placeholder")}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onPaste={(e) => {
            const pasted = [...e.clipboardData.files];
            if (pasted.length === 0) return;
            e.preventDefault();
            attach(pasted);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Group gap="xs" wrap="nowrap">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              attach([...(e.currentTarget.files ?? [])]);
              e.currentTarget.value = "";
            }}
          />
          <Button type="button" size="compact-sm" variant="default" fw={400} disabled={!!unavailable} title={t("chat.attach")} aria-label={t("chat.attach")} onClick={() => picker.current?.click()}>
            +
          </Button>
          <Text visibleFrom="md" flex={1} fz={12} c="dimmed">{t("chat.hint")}</Text>
          <Box flex={1} hiddenFrom="md" />
          {busy ? (
            <Button type="button" variant="default" onClick={onStop}>
              {t("chat.stop")}
            </Button>
          ) : (
            <Button type="submit" leftSection={<Icon name="send" />} disabled={(!draft.trim() && files.length === 0) || !!unavailable}>
              {t("chat.send")}
            </Button>
          )}
        </Group>
      </Stack>
    </Stack>
  );
}
