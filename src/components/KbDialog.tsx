import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
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
  if (!onLoad) return <span className="muted note">{t("kb.noProject")}</span>;
  return ask ? (
    <span className="kb-confirm">
      {t("kb.replace")}
      <button
        className="primary"
        onClick={() => {
          setAsk(false);
          onLoad(code);
        }}
      >
        {t("kb.replaceYes")}
      </button>
      <button onClick={() => setAsk(false)}>{t("common.cancel")}</button>
    </span>
  ) : (
    <button onClick={() => setAsk(true)}>{t("kb.load")}</button>
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
        <p className="muted note">{t("kb.desktopOnly")}</p>
      ) : open && doc ? (
        <>
          <div className="kb-bar">
            <button onClick={() => setOpen(null)}>← {t("kb.back")}</button>
            <code className="kb-path">{open.path}</code>
          </div>
          {doc.map((p, i) =>
            p.code ? (
              <div className="kb-block" key={i}>
                <pre>{p.text}</pre>
                {(SCAD_LANGS.has(p.lang) || open.path.toLowerCase().endsWith(".scad")) && (
                  <div className="kb-actions">
                    <LoadButton code={p.text} onLoad={onLoad} />
                  </div>
                )}
              </div>
            ) : (
              <p className="kb-prose" key={i}>{p.text}</p>
            ),
          )}
        </>
      ) : (
        <>
          <input
            type="search"
            className="kb-search"
            autoFocus
            value={query}
            placeholder={t("kb.placeholder")}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          {problem && <p className="note mcp-bad">{problem}</p>}
          {hits ? (
            hits.length === 0 ? (
              <p className="muted note">{t("kb.none")}</p>
            ) : (
              hits.map((h, i) => (
                <button key={i} className="kb-hit" onClick={() => show(h.path)}>
                  <span className="kb-hit-head">
                    <code>{h.path}</code>
                    {h.heading && <span className="muted"> · {h.heading}</span>}
                  </span>
                  <span className="kb-snippet">{h.snippet}</span>
                </button>
              ))
            )
          ) : (
            <p className="muted note">{t("kb.hint")}</p>
          )}
        </>
      )}
    </Dialog>
  );
}
