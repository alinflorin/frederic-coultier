import { Button, Text } from "@mantine/core";
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
          <Button variant="default" onClick={onDiscard}>{t("file.discardButton")}</Button>
          <span style={{ flex: 1 }} />
          <Button variant="default" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button autoFocus onClick={onSave}>{t("menu.save")}</Button>
        </>
      }
    >
      <Text>{t("file.unsavedBody", { name })}</Text>
    </Dialog>
  );
}
