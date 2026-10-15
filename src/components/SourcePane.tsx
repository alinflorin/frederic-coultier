import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";

const KEYWORDS = /\b(module|function|for|if|else|let|difference|union|intersection|translate|rotate|scale|mirror|cylinder|cube|sphere|polygon|linear_extrude|rotate_extrude|hull|true|false)\b/g;

function highlight(line: string) {
  const ci = line.indexOf("//");
  const code = ci >= 0 ? line.slice(0, ci) : line;
  const comment = ci >= 0 ? line.slice(ci) : "";
  const parts: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(`${KEYWORDS.source}|\\b\\d+(?:\\.\\d+)?\\b|\\$[a-z_]+`, "g");
  for (const m of code.matchAll(re)) {
    if (m.index > last) parts.push(code.slice(last, m.index));
    const cls = /^\d/.test(m[0]) ? "tok-num" : m[0].startsWith("$") ? "tok-var" : "tok-kw";
    parts.push(<span key={m.index} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  parts.push(code.slice(last));
  if (comment) parts.push(<span key="c" className="tok-com">{comment}</span>);
  return parts;
}

export function SourcePane({ source, errorLine }: { source: string; errorLine?: number | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const lines = source.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  function copy() {
    navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <section className="pane source-pane" aria-label={t("source.title")}>
      <header className="pane-head">
        <div className="file-tab">
          <Icon name="code" /> model.scad
        </div>
        <span className="muted readonly">{t("source.readonly")}</span>
        <button className="icon-btn" onClick={copy} title={t("source.copy")} aria-label={t("source.copy")}>
          <Icon name={copied ? "check" : "copy"} />
        </button>
      </header>
      <pre className="code" tabIndex={0}>
        {lines.map((l, i) => (
          <div className={`line${errorLine === i + 1 ? " err" : ""}`} key={i}>
            <span className="ln">{i + 1}</span>
            <span className="lc">{highlight(l)}</span>
          </div>
        ))}
      </pre>
    </section>
  );
}
