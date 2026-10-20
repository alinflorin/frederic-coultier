import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ActionIcon, Box, Button, Checkbox, CloseButton, Collapse, Group, Image, Indicator, Loader, Menu, NativeSelect, Popover, Progress, Stack, Text, Textarea, Title, Tooltip, UnstyledButton, type BoxProps } from "@mantine/core";
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
    <Box className="md" fz="inherit" style={{ overflowWrap: "anywhere", maxWidth: "100%" }}>
      <Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>
        {text}
      </Markdown>
    </Box>
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
          bg="var(--surface-2)"
          bd="1px solid var(--border)"
          style={{ minWidth: 0, overflow: "hidden", borderRadius: 10 }}
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

/** The agent's mark next to its messages. */
function Avatar({ busy }: { busy?: boolean }) {
  return (
    <Box c="var(--accent)" mt={1} style={{ display: "flex", flex: "none", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 9, background: "var(--accent-soft)", opacity: busy ? 0.8 : 1 }}>
      <Icon name="sparkle" size={14} />
    </Box>
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
  const stateColor = state === "error" || state === "unavailable" ? "var(--bad)" : state === "idle" ? "var(--ok)" : "var(--accent)";
  const active = conversations.find((c) => c.id === activeId);
  const select = (value: string, onChange: (v: string) => void, data: { value: string; label: string; disabled?: boolean }[], label: string) => (
    <NativeSelect size="xs" label={label} value={value} disabled={busy} data={data} onChange={(e) => onChange(e.currentTarget.value)} styles={{ label: { fontSize: 11, color: "var(--muted)", marginBottom: 3 } }} />
  );
  const canSend = (draft.trim() || files.length > 0) && !unavailable;

  return (
    <Stack className="pane" component="section" gap={0} aria-label={t("chat.title")}>
      <Group className="pane-head" gap={6} wrap="nowrap">
        <Box c="var(--accent)" p={5} style={{ display: "flex", borderRadius: 8, background: "var(--accent-soft)", flex: "none" }}>
          <Icon name="sparkle" size={14} />
        </Box>
        <Menu position="bottom-start" offset={6} width={280} disabled={busy}>
          <Menu.Target>
            <UnstyledButton px={6} py={4} fw={600} fz={13} style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, borderRadius: 8 }} aria-label={t("chat.conversation")}>
              <Text inherit truncate="end">{active?.title || t("chat.untitled")}</Text>
              <Box c="dimmed" style={{ display: "flex", flex: "none" }}><Icon name="chevron" size={13} /></Box>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            {conversations.map((c) => (
              <Menu.Item key={c.id} onClick={() => onSelect(c.id)} c={c.id === activeId ? "var(--accent)" : undefined} bg={c.id === activeId ? "var(--accent-soft)" : undefined}>
                <Text inherit truncate="end">{c.title || t("chat.untitled")}</Text>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Group gap={5} wrap="nowrap" fz={11.5} c="dimmed" role="status" title={error ?? unavailable ?? undefined} style={{ whiteSpace: "nowrap", flex: "none" }}>
          <Indicator inline size={7} color={stateColor} processing={state === "working" || state === "compacting"} offset={0} position="middle-center" withBorder={false}>
            <span style={{ display: "block", width: 7, height: 7 }} />
          </Indicator>
          <span className="hide-narrow">{t(`chat.state.${state}`)}</span>
        </Group>
        <Box flex={1} />
        <Tooltip label={t("chat.new")}>
          <ActionIcon variant="subtle" color="gray" disabled={busy || messages.length === 0} onClick={onNew} aria-label={t("chat.new")}>
            <Icon name="plus" size={16} />
          </ActionIcon>
        </Tooltip>
        <Popover position="bottom-end" offset={6} width={300} trapFocus={false}>
          <Popover.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={t("preview.display")}>
              <Icon name="gear" size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown p="md">
            <Stack gap="sm">
              {engines.length > 1 && engineId && select(engineId, onEngine, engines.map((e) => ({ value: e.id, label: e.label, disabled: !e.available })), t("chat.agent"))}
              {models.length > 0 &&
                select(model, onModel, [{ value: "", label: modelDefault ? t("chat.defaultNamed", { name: modelDefault }) : t("chat.default") }, ...models.map((m) => ({ value: m.id, label: m.label }))], t("chat.model"))}
              {efforts.length > 0 &&
                select(effort, onEffort, [{ value: "", label: effortDefault ? t("chat.defaultNamed", { name: effortDefault }) : t("chat.effortDefault") }, ...efforts.map((l) => ({ value: l, label: l }))], t("chat.effort"))}
              <Checkbox size="xs" label={t("chat.autoCompact")} title={t("chat.autoCompactHint", { percent: Math.round(AUTO_COMPACT_AT * 100) })} checked={autoCompact} onChange={(e) => onAutoCompact(e.currentTarget.checked)} />
              <Checkbox size="xs" label={t("chat.chime")} title={t("chat.chimeHint", { secs: chime.secs })} checked={chime.on} onChange={(e) => setChimeOn(e.currentTarget.checked)} />
              <Group gap={6} grow>
                <Button size="compact-sm" variant="default" fw={500} disabled={busy || !canCompact} onClick={onCompact} title={t("chat.compactHint")}>
                  {t("chat.compact")}
                </Button>
                <Button
                  size="compact-sm"
                  variant="default"
                  fw={500}
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
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
      {(usedContext || shownLimits.length > 0) && (
        <Group gap="4px 14px" px={14} py={6} fz={11.5} c="dimmed" bd="0 solid var(--border)" style={{ flex: "none", borderBottomWidth: 1 }}>
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
      <Stack gap={16} p={16} role="log" aria-live="polite" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {messages.length === 0 && !live && (
          <Stack align="center" gap="xs" m="auto" maw={380} ta="center" className="fade-up">
            <Box c="var(--accent)" p={12} mb={4} style={{ display: "flex", borderRadius: 16, background: "var(--accent-soft)" }}>
              <Icon name="sparkle" size={26} />
            </Box>
            <Title order={3} fz={18} fw={650} lts="-0.01em" c="var(--text)">{t("chat.emptyTitle")}</Title>
            <Text c="dimmed" fz={13} lh={1.5}>{t("chat.emptyHint")}</Text>
            {!unavailable && (
              <Stack gap={8} mt={14} w="100%">
                {suggestions.map((s) => (
                  <UnstyledButton
                    key={s}
                    className="lift"
                    onClick={() => !busy && onSend(s)}
                    px={14}
                    py={10}
                    fz={13}
                    ta="left"
                    bd="1px solid var(--border)"
                    style={{ borderRadius: 12, background: "var(--surface-2)", display: "flex", gap: 10, alignItems: "center", opacity: busy ? 0.5 : 1 }}
                  >
                    <Box c="var(--accent)" style={{ display: "flex", flex: "none" }}><Icon name="sparkle" size={13} /></Box>
                    {s}
                  </UnstyledButton>
                ))}
              </Stack>
            )}
          </Stack>
        )}
        {messages.map((m) =>
          m.role === "note" ? (
            <Text key={m.id} className="chip" style={{ alignSelf: "center" }}>
              {m.text === "compacted" ? t("chat.compacted") : m.text}
            </Text>
          ) : m.role === "user" ? (
            <Group key={m.id} wrap="nowrap" justify="flex-end" style={{ minWidth: 0 }} className="fade-up">
              <Box
                maw="88%"
                px={14}
                py={9}
                fz={13.5}
                lh={1.5}
                c="var(--accent-text)"
                style={{ minWidth: 0, borderRadius: 16, borderBottomRightRadius: 5, background: "var(--accent-grad)", boxShadow: "0 2px 10px color-mix(in srgb, var(--accent) 28%, transparent)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {m.files && m.files.length > 0 && <Box mb={6} c="var(--text)"><Files files={m.files} /></Box>}
                {m.text}
              </Box>
            </Group>
          ) : (
            <Group key={m.id} wrap="nowrap" align="flex-start" gap={10} style={{ minWidth: 0 }} className="fade-up">
              <Avatar />
              <Box fz={13.5} style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
                {m.thinking && <Thought text={m.thinking} />}
                {m.text && <Say text={m.text} />}
                {m.tools && <Tools tools={m.tools.filter((c) => typeof c === "object")} />}
                {m.change && (
                  <Group gap={6} mt={8} px={9} py={4} fz={12} ff="monospace" bg="var(--surface-2)" bd="1px solid var(--border)" w="fit-content" wrap="nowrap" style={{ borderRadius: 8 }}>
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
          <Group wrap="nowrap" align="flex-start" gap={10} style={{ minWidth: 0 }}>
            {working === "compact" ? (
              <Text className="chip" style={{ alignSelf: "center", margin: "0 auto" }}>{t("chat.compacting")}</Text>
            ) : (
              <>
                <Avatar busy />
                <Box fz={13.5} aria-label={t("chat.thinking")} style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
                  {live.thinking.trim() && <Thought text={live.thinking} open={!live.text} />}
                  {live.text ? <Say text={live.text} /> : !live.thinking.trim() && <Loader type="dots" size="sm" color="dimmed" />}
                  {live.tools.length > 0 && <Tools tools={live.tools} />}
                </Box>
              </>
            )}
          </Group>
        )}
        {error && <Text role="alert" fz={13} c="var(--bad)" px={12} py={9} bg="color-mix(in srgb, var(--bad) 10%, transparent)" bd="1px solid color-mix(in srgb, var(--bad) 35%, transparent)" style={{ borderRadius: 10, overflowWrap: "anywhere" }}>{error}</Text>}
        <div ref={endRef} />
      </Stack>
      {unavailable && <Text fz={13} c="var(--bad)" mx={12} mb={8} px={12} py={9} bg="color-mix(in srgb, var(--bad) 10%, transparent)" style={{ borderRadius: 10, overflowWrap: "anywhere" }}>{unavailable}</Text>}
      <Box p={12} pt={4} style={{ flex: "none" }}>
        <Stack
          component="form"
          gap={4}
          p={8}
          bd="1px solid var(--border)"
          style={{
            borderRadius: 16,
            background: "var(--surface-2)",
            transition: "border-color .15s, box-shadow .15s",
            ...(over ? { borderColor: "var(--accent)", borderStyle: "dashed" } : {}),
          }}
          onFocusCapture={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px var(--accent-soft)")}
          onBlurCapture={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "none")}
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
          {files.length > 0 && <Box px={4} pt={2}><Files files={files} onRemove={(i) => setFiles((cur) => cur.filter((_, j) => j !== i))} /></Box>}
          {problem && <Text fz={12.5} c="var(--bad)" px={6} style={{ overflowWrap: "anywhere" }}>{problem}</Text>}
          <Textarea
            variant="unstyled"
            value={draft}
            autosize
            minRows={2}
            maxRows={8}
            disabled={!!unavailable}
            placeholder={t("chat.placeholder")}
            styles={{ input: { padding: "4px 8px", fontSize: 13.5 } }}
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
          <Group gap={4} wrap="nowrap">
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
            <Tooltip label={t("chat.attach")}>
              <ActionIcon type="button" variant="subtle" color="gray" disabled={!!unavailable} aria-label={t("chat.attach")} onClick={() => picker.current?.click()}>
                <Icon name="attach" size={16} />
              </ActionIcon>
            </Tooltip>
            <Text visibleFrom="md" className="hide-narrow" flex={1} fz={11} c="dimmed" pl={4}>{t("chat.hint")}</Text>
            <Box flex={1} hiddenFrom="md" />
            {busy ? (
              <Button type="button" size="compact-md" variant="default" radius="xl" onClick={onStop} leftSection={<Box w={9} h={9} bg="currentColor" style={{ borderRadius: 2 }} />}>
                {t("chat.stop")}
              </Button>
            ) : (
              <ActionIcon type="submit" size={34} radius="xl" disabled={!canSend} aria-label={t("chat.send")} title={t("chat.send")} style={canSend ? undefined : { background: "var(--surface-3)", border: "1px solid var(--border)", boxShadow: "none" }}>
                <Icon name="send" size={16} />
              </ActionIcon>
            )}
          </Group>
        </Stack>
      </Box>
    </Stack>
  );
}
