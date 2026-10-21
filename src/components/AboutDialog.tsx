import { useEffect, useState } from "react";
import { Image, Stack, Text, Title } from "@mantine/core";
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
      <Stack align="center" gap={4} py="xs">
        <Image src="/logo.svg" alt="" w={64} h={64} />
        <Title order={3} mt="xs">Frederic Coultier</Title>
        <Text c="dimmed">{t("about.version", { version: version || "—" })}</Text>
        <Text c="dimmed" fz={12} ta="center" mt="xs">{t("about.credits")}</Text>
      </Stack>
    </Dialog>
  );
}
