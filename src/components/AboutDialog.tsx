import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { Dialog } from "./Dialog";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <Dialog title={t("about.title")} onClose={onClose}>
      <div className="about">
        <img src="/logo.svg" alt="" width={64} height={64} />
        <h3>Frederic Coultier</h3>
        <p>{t("about.version", { version: version || "—" })}</p>
      </div>
    </Dialog>
  );
}
