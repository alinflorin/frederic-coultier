import { useTranslation } from "react-i18next";
import type { Recent } from "../project";
import { Icon } from "./Icon";

export function Welcome({
  recents,
  onNew,
  onOpen,
  onOpenRecent,
  onSample,
}: {
  recents: Recent[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onSample: () => void;
}) {
  const { t } = useTranslation();
  return (
    <main className="welcome">
      <img src="/logo.svg" width={64} height={64} alt="" />
      <h1>Frederic Coultier</h1>
      <p className="muted">{t("welcome.tagline")}</p>
      <div className="welcome-actions">
        <button className="primary" onClick={onNew}>{t("welcome.new")}</button>
        <button onClick={onOpen}><Icon name="folder" /> {t("welcome.open")}</button>
        <button onClick={onSample}>{t("welcome.sample")}</button>
      </div>
      {recents.length > 0 && (
        <div className="recent">
          <h3>{t("welcome.recent")}</h3>
          {recents.map((r) => (
            <button key={r.path} className="recent-item" onClick={() => onOpenRecent(r.path)}>
              <b>{r.name}</b>
              <span className="muted">{r.path}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
