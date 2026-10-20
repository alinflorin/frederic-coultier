import { useEffect, useRef, useState } from "react";
import { ActionIcon, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { openscadLanguage } from "./openscad";
import { Icon } from "./Icon";
import { ParamsPanel } from "./ParamsPanel";

const setErrorLine = StateEffect.define<number | null>();

/** Marks the line the renderer complained about. */
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setErrorLine)) continue;
      const n = e.value;
      deco =
        n && n >= 1 && n <= tr.state.doc.lines
          ? Decoration.set([Decoration.line({ class: "cm-errorLine" }).range(tr.state.doc.line(n).from)])
          : Decoration.none;
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setHit = StateEffect.define<{ from: number; to: number } | null>();

/** The statement a spot of the piece comes from (see the "find in source" tool). */
const hitField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setHit)) continue;
      const r = e.value;
      const len = tr.state.doc.length;
      deco = r && r.to > r.from && r.to <= len ? Decoration.set([Decoration.mark({ class: "cm-sourceHit" }).range(r.from, r.to)]) : Decoration.none;
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  "&": { height: "100%", background: "transparent", color: "var(--text)", fontSize: "12.5px" },
  ".cm-scroller": { fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace', lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-gutters": { background: "transparent", color: "var(--muted)", border: "none", opacity: 0.7 },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px" },
  ".cm-line": { padding: "0 14px 0 6px" },
  ".cm-activeLine": { background: "color-mix(in srgb, var(--accent) 7%, transparent)" },
  ".cm-activeLineGutter": { background: "transparent", color: "var(--text)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { background: "var(--accent-soft)" },
  ".cm-selectionMatch": { background: "var(--accent-soft)" },
  ".cm-errorLine": { background: "color-mix(in srgb, var(--bad) 22%, transparent)", boxShadow: "inset 3px 0 0 var(--bad)" },
  ".cm-sourceHit": { background: "color-mix(in srgb, var(--accent) 28%, transparent)", borderBottom: "2px solid var(--accent)" },
  ".cm-panels": { background: "var(--float-bg)", color: "var(--text)", borderColor: "var(--border)" },
  ".cm-tooltip": { background: "var(--float-bg)", border: "1px solid var(--border)", color: "var(--text)" },
});

export function SourcePane({
  source,
  errorLine,
  highlight,
  onChange,
}: {
  source: string;
  errorLine?: number | null;
  /** A range to mark and scroll to (editor offsets), or null for none. */
  highlight?: { from: number; to: number } | null;
  onChange: (source: string) => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: source,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          openscadLanguage,
          EditorView.lineWrapping,
          errorLineField,
          hitField,
          theme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor owns its document after creation; `source` is synced in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Source changed from outside the editor (e.g. the AI edited it): replace the document.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== source) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: source } });
    }
  }, [source]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine ?? null) });
  }, [errorLine, source]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const r = highlight && highlight.to <= v.state.doc.length ? highlight : null;
    v.dispatch({
      effects: [setHit.of(r), ...(r ? [EditorView.scrollIntoView(r.from, { y: "center" })] : [])],
    });
    // the highlight is about the source as it was when the spot was clicked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  function copy() {
    navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <Stack className="pane" component="section" gap={0} aria-label={t("source.title")}>
      <Group component="header" className="pane-head" wrap="nowrap">
        <Box c="var(--accent)" style={{ display: "flex" }}><Icon name="code" size={15} /></Box>
        <Text fw={600} fz={12.5} ff="monospace">model.scad</Text>
        <Tooltip label={t("source.copy")}>
          <ActionIcon variant="subtle" color="gray" ml="auto" onClick={copy} aria-label={t("source.copy")}>
            <Icon name={copied ? "check" : "copy"} size={15} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ParamsPanel source={source} onChange={onChange} />
      <Box ref={host} style={{ flex: 1, minHeight: 160, overflow: "hidden" }} />
    </Stack>
  );
}
