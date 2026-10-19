import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Box, Button, Code, Group, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { inTauri } from "../api";
import { Dialog } from "./Dialog";

interface Hit {
  path: string;
  heading: string;
  start: number;
  end: number;
  snippet: string;
}
/** A piece of a document: prose, or a fenced block with its language. */
type Part = { code: false; text: string } | { code: true; lang: string; text: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));
const SCAD_LANGS = new Set(["scad", "openscad"]);

/** Splits Markdown at its fenced code blocks. */
function parts(text: string): Part[] {
  const out: Part[] = [];
  const re = /^```[ \t]*([\w+-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ code: false, text: text.slice(last, m.index) });
    out.push({ code: true, lang: m[1].toLowerCase(), text: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ code: false, text: text.slice(last) });
  return out;
}

/** A button that asks twice before it replaces the source, since that discards what is in the editor. */
function LoadButton({ code, onLoad }: { code: string; onLoad: ((code: string) => void) | null }) {
  const { t } = useTranslation();
  const [ask, setAsk] = useState(false);
  if (!onLoad) return <Text fz={12} c="dimmed">{t("kb.noProject")}</Text>;
  return ask ? (
    <Group gap={8}>
      {t("kb.replace")}
      <Button
        size="compact-sm"
        onClick={() => {
          setAsk(false);
          onLoad(code);
        }}
      >
        {t("kb.replaceYes")}
      </Button>
      <Button size="compact-sm" variant="default" onClick={() => setAsk(false)}>{t("common.cancel")}</Button>
    </Group>
  ) : (
    <Button size="compact-sm" variant="default" onClick={() => setAsk(true)}>{t("kb.load")}</Button>
  );
}

/** Help > Knowledge base: search the notes that ship with the app, read them, and load example code into the editor. */
export function KbDialog({ onLoad, onClose }: { onLoad: ((code: string) => void) | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState<{ path: string; text: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!inTauri()) return;
    const q = query.trim();
    if (!q) {
      setHits(null);
      return;
    }
    const id = setTimeout(() => {
      invoke<Hit[]>("kb_search", { query: q }).then(setHits, (e) => setProblem(errorText(e)));
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  async function show(path: string) {
    setProblem(null);
    try {
      setOpen({ path, text: await invoke<string>("kb_read", { path }) });
    } catch (e) {
      setProblem(errorText(e));
    }
  }

  const doc = open && (open.path.toLowerCase().endsWith(".scad") ? [{ code: true, lang: "scad", text: open.text } as Part] : parts(open.text));

  return (
    <Dialog wide title={t("kb.title")} onClose={onClose}>
      {!inTauri() ? (
        <Text fz={12} c="dimmed">{t("kb.desktopOnly")}</Text>
      ) : open && doc ? (
        <>
          <Group gap={10} mb={10}>
            <Button variant="default" size="compact-sm" onClick={() => setOpen(null)}>← {t("kb.back")}</Button>
            <Code fz={12} c="dimmed" style={{ overflowWrap: "anywhere" }}>{open.path}</Code>
          </Group>
          {doc.map((p, i) =>
            p.code ? (
              <Box key={i} mt={8} mb={12}>
                <Box component="pre" m={0} p={10} fz={12} bg="var(--code-bg)" bd="1px solid var(--border)" style={{ overflowX: "auto", borderRadius: 6 }}>{p.text}</Box>
                {(SCAD_LANGS.has(p.lang) || open.path.toLowerCase().endsWith(".scad")) && (
                  <Group gap={8} mt={6}>
                    <LoadButton code={p.text} onLoad={onLoad} />
                  </Group>
                )}
              </Box>
            ) : (
              <Text key={i} mb={10} lh={1.5} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.text}</Text>
            ),
          )}
        </>
      ) : (
        <>
          <TextInput
            type="search"
            data-autofocus
            mb={10}
            value={query}
            placeholder={t("kb.placeholder")}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          {problem && <Text fz={12} c="var(--bad)">{problem}</Text>}
          {hits ? (
            hits.length === 0 ? (
              <Text fz={12} c="dimmed">{t("kb.none")}</Text>
            ) : (
              <Stack gap={6}>
                {hits.map((h, i) => (
                  <UnstyledButton key={i} onClick={() => show(h.path)} p="8px 10px" bd="1px solid var(--border)" style={{ borderRadius: 6, display: "block", width: "100%" }}>
                    <Text fz={13} mb={4}>
                      <Code>{h.path}</Code>
                      {h.heading && <Text span inherit c="dimmed"> · {h.heading}</Text>}
                    </Text>
                    <Text fz={12} c="dimmed" mah="7.5em" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden" }}>{h.snippet}</Text>
                  </UnstyledButton>
                ))}
              </Stack>
            )
          ) : (
            <Text fz={12} c="dimmed">{t("kb.hint")}</Text>
          )}
        </>
      )}
    </Dialog>
  );
}
