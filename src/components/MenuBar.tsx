import { useEffect, useRef, useState } from "react";

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
  /** A menu with no `items` is a plain button that runs this. */
  onSelect?: () => void;
  items?: MenuItem[];
}

export function MenuBar({ menus, title, dirty }: { menus: Menu[]; title: string; dirty: boolean }) {
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
        <img src="/logo.svg" width={20} height={20} alt="" />
        <span>Frederic Coultier</span>
      </div>
      <nav className="menus" role="menubar">
        {menus.map((m) => (
          <div className="menu" key={m.id}>
            <button
              role="menuitem"
              aria-haspopup={m.items ? "true" : undefined}
              aria-expanded={m.items ? open === m.id : undefined}
              className={open === m.id ? "active" : ""}
              onClick={() => {
                if (!m.items) {
                  setOpen(null);
                  m.onSelect?.();
                } else setOpen(open === m.id ? null : m.id);
              }}
              onMouseEnter={() => open && setOpen(m.items ? m.id : null)}
            >
              {m.label}
            </button>
            {m.items && open === m.id && (
              <ul className="dropdown" role="menu">
                {m.items!.map((it, i) =>
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
    </div>
  );
}
