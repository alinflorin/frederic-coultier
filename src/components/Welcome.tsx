import { Box, Button, Group, Image, Stack, Text, Title, UnstyledButton } from "@mantine/core";
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
    <Stack component="main" flex={1} align="center" justify="center" gap="xs" p="lg" ta="center" c="var(--accent)" style={{ minHeight: 0, overflowY: "auto" }}>
      <Image src="/logo.svg" w={64} h={64} alt="" />
      <Title order={1} fz={28} fw={600} c="var(--text)">Frederic Coultier</Title>
      <Text c="dimmed" maw={420}>{t("welcome.tagline")}</Text>
      <Group gap="sm" justify="center" mt={14} mb={22}>
        <Button onClick={onNew}>{t("welcome.new")}</Button>
        <Button variant="default" leftSection={<Icon name="folder" />} onClick={onOpen}>{t("welcome.open")}</Button>
        <Button variant="default" onClick={onSample}>{t("welcome.sample")}</Button>
      </Group>
      {recents.length > 0 && (
        <Stack gap={6} w="min(100%, 420px)" ta="left" c="var(--text)">
          <Text fz={12} tt="uppercase" lts="0.06em" c="dimmed" component="h3">{t("welcome.recent")}</Text>
          {recents.map((r) => (
            <UnstyledButton
              key={r.path}
              onClick={() => onOpenRecent(r.path)}
              p="8px 12px"
              bg="var(--surface-2)"
              bd="1px solid var(--border)"
              style={{ borderRadius: 6, minWidth: 0 }}
            >
              <Box fw={700} style={{ overflowWrap: "anywhere" }}>{r.name}</Box>
              <Text c="dimmed" inherit style={{ overflowWrap: "anywhere" }}>{r.path}</Text>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
