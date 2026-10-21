import { Button, Indicator, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { RhinoStatus } from "../rhino";

/** Rhino in the menu bar: found or not, and the document it has open. Opens the preferences, where the address is. */
export function RhinoIndicator({ status, onClick }: { status: RhinoStatus | null; onClick: () => void }) {
  const { t } = useTranslation();
  if (!status) return null;
  const ok = status.connected;
  const inMm = status.unitMm === 1;
  const label = ok ? (status.document ?? t("rhino.untitled")) : t("rhino.off");
  const title = ok
    ? [
        t("rhino.connected", { host: status.host, port: status.port }),
        `${t("rhino.document")}: ${status.document ?? t("rhino.untitled")}`,
        `${t("rhino.units")}: ${status.units ?? "?"}${inMm ? "" : ` — ${t("rhino.notMm")}`}`,
        t("rhino.objects", { count: status.objects ?? 0 }),
      ].join("\n")
    : `${t("rhino.offTitle", { host: status.host, port: status.port })}\n${status.error ?? ""}`;
  const dot = !ok ? "var(--bad)" : inMm ? "var(--ok)" : "var(--accent)";

  return (
    <Button
      variant="default"
      radius="xl"
      size="compact-sm"
      fw={400}
      c={ok ? "var(--text)" : "var(--bad)"}
      bd={ok ? undefined : "1px solid var(--bad)"}
      title={title}
      onClick={onClick}
      style={{ flex: "none", maxWidth: 260 }}
      leftSection={
        <Indicator inline size={8} color={dot} offset={0} position="middle-center" zIndex={1} withBorder={false}>
          <span style={{ display: "block", width: 8, height: 8 }} />
        </Indicator>
      }
    >
      <Text span inherit visibleFrom="md" truncate>
        {t("rhino.name")} · {label}
      </Text>
    </Button>
  );
}
