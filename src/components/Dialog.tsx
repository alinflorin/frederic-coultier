import type { ReactNode } from "react";
import { Group, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";

export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
  fixed,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** The content manages its own scrolling (e.g. a side menu that must stay put). */
  fixed?: boolean;
}) {
  const { t } = useTranslation();
  const phone = useMediaQuery("(max-width: 600px)", false, { getInitialValueInEffect: false });
  return (
    <Modal
      opened
      onClose={onClose}
      title={title}
      size={wide ? 760 : 480}
      centered
      fullScreen={phone}
      closeButtonProps={{ "aria-label": t("common.close") }}
      styles={wide && !phone ? { content: { height: "min(660px, 100%)", display: "flex", flexDirection: "column" }, body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } } : undefined}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: fixed ? "hidden" : "auto" }}>{children}</div>
      {footer && (
        <Group gap="xs" mt="md" wrap={phone ? "wrap" : "nowrap"}>
          {footer}
        </Group>
      )}
    </Modal>
  );
}
