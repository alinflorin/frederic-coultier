import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { Icon } from "./Icon";

export interface MenuItem {
  label: string;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  separator?: boolean;
}
export interface Menu {
  id: string;
  label: string;
  items: MenuItem[];
}

export function MenuBar({ menus, title, dirty }: { menus: Menu[]; title: string; dirty: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="menubar" ref={ref}>
      <div className="brand">
        <Icon name="sparkle" size={18} />
        <span>Frederic Coultier</span>
      </div>
      <nav className="menus" role="menubar">
        {menus.map((m) => (
          <div className="menu" key={m.id}>
            <button
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={open === m.id}
              className={open === m.id ? "active" : ""}
              onClick={() => setOpen(open === m.id ? null : m.id)}
              onMouseEnter={() => open && setOpen(m.id)}
            >
              {m.label}
            </button>
            {open === m.id && (
              <ul className="dropdown" role="menu">
                {m.items.map((it, i) =>
                  it.separator ? (
                    <li key={i} className="sep" role="separator" />
                  ) : (
                    <li key={i}>
                      <button
                        role="menuitem"
                        disabled={it.disabled}
                        onClick={() => {
                          setOpen(null);
                          it.onSelect?.();
                        }}
                      >
                        <span>{it.label}</span>
                        {it.shortcut && <kbd>{it.shortcut}</kbd>}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        ))}
      </nav>
      <div className="doc-title" title={title}>
        {title}
        {dirty && <span className="dirty" aria-label="unsaved">●</span>}
      </div>
      <select
        className="lang"
        aria-label="Language"
        value={i18n.resolvedLanguage}
        onChange={(e) => setLanguage(e.currentTarget.value as Language)}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
