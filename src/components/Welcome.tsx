import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";

export function Welcome({ onNew, onOpen, onSample }: { onNew: () => void; onOpen: () => void; onSample: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="welcome">
      <Icon name="sparkle" size={40} />
      <h1>Frederic Coultier</h1>
      <p className="muted">{t("welcome.tagline")}</p>
      <div className="welcome-actions">
        <button className="primary" onClick={onNew}>{t("welcome.new")}</button>
        <button onClick={onOpen}><Icon name="folder" /> {t("welcome.open")}</button>
      </div>
      <div className="recent">
        <h3>{t("welcome.recent")}</h3>
        <button className="recent-item" onClick={onSample}>
          <b>Solitaire ring.fc</b>
          <span className="muted">~/Jewelry/Solitaire ring.fc</span>
        </button>
      </div>
    </main>
  );
}
