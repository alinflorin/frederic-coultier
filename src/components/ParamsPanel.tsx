import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { humanize, parseParams, setParam } from "../params";
import { getPref, setPref } from "../prefs";
import { Icon } from "./Icon";

/** Sliders for the numeric parameters at the top of the source. Dragging rewrites the number in place. */
export function ParamsPanel({ source, onChange }: { source: string; onChange: (source: string) => void }) {
  const { t } = useTranslation();
  const params = useMemo(() => parseParams(source), [source]);
  const [open, setOpen] = useState(() => getPref<boolean>("paramsOpen") !== false);
  if (params.length === 0) return null;
  const toggle = () => {
    setPref("paramsOpen", !open);
    setOpen(!open);
  };

  return (
    <div className="params">
      <button className="params-head" onClick={toggle} aria-expanded={open}>
        <Icon name="chevron" size={14} />
        {t("params.title")} <span className="muted">({params.length})</span>
      </button>
      {open && (
        <div className="params-body">
          {params.map((p) => (
            <div className="param" key={p.name} title={p.note || p.name}>
              <label htmlFor={`param-${p.name}`}>
                {humanize(p.name)}
                {p.note && <span className="muted"> {p.note}</span>}
              </label>
              {p.kind === "bool" ? (
                <input id={`param-${p.name}`} type="checkbox" checked={p.value as boolean} onChange={(e) => onChange(setParam(source, p, e.currentTarget.checked))} />
              ) : (
                <>
                  <input
                    id={`param-${p.name}`}
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={p.value as number}
                    onChange={(e) => onChange(setParam(source, p, e.currentTarget.valueAsNumber))}
                  />
                  <input
                    className="param-num"
                    type="number"
                    step={p.step}
                    value={p.value as number}
                    aria-label={humanize(p.name)}
                    onChange={(e) => Number.isFinite(e.currentTarget.valueAsNumber) && onChange(setParam(source, p, e.currentTarget.valueAsNumber))}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
