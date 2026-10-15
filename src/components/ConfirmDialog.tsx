import { useTranslation } from "react-i18next";
import { Dialog } from "./Dialog";

/** "Save changes?" with Save / Discard / Cancel. */
export function ConfirmDialog({
  name,
  onSave,
  onDiscard,
  onCancel,
}: {
  name: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      title={t("file.unsavedTitle")}
      onClose={onCancel}
      footer={
        <>
          <button onClick={onDiscard}>{t("file.discardButton")}</button>
          <span className="grow" />
          <button onClick={onCancel}>{t("common.cancel")}</button>
          <button className="primary" autoFocus onClick={onSave}>{t("menu.save")}</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{t("file.unsavedBody", { name })}</p>
    </Dialog>
  );
}
