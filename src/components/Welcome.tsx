import { Box, Group, Image, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { motion, type Variants } from "motion/react";
import { useTranslation } from "react-i18next";
import type { Recent } from "../project";
import { Icon } from "./Icon";

const rise: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };

function Action({ icon, label, primary, onClick }: { icon: string; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={onClick}
      className="lift"
      px={18}
      py={14}
      miw={150}
      c={primary ? "var(--accent-text)" : "var(--text)"}
      bd={primary ? "1px solid color-mix(in srgb, var(--accent) 70%, #000)" : "1px solid var(--glass-border)"}
      style={{
        borderRadius: 12,
        background: primary ? "var(--accent-grad)" : "var(--glass)",
        boxShadow: primary ? "0 1px 0 rgba(255,255,255,.25) inset, 0 6px 20px color-mix(in srgb, var(--accent) 35%, transparent)" : "var(--float-shadow)",
      }}
    >
      <Stack gap={10} align="flex-start">
        <Box c={primary ? "inherit" : "var(--accent)"} style={{ display: "flex" }}><Icon name={icon} size={20} /></Box>
        <Text fw={600} fz={13.5} inherit>{label}</Text>
      </Stack>
    </UnstyledButton>
  );
}

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
    <Box component="main" flex={1} pos="relative" style={{ minHeight: 0, overflowX: "hidden", overflowY: "auto", zIndex: 1 }}>
      <motion.div variants={stagger} initial="hidden" animate="show" style={{ position: "relative", maxWidth: 760, margin: "0 auto", padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
        <motion.div variants={rise} whileHover={{ rotate: -4, scale: 1.06 }} className="glass" style={{ borderRadius: 26, display: "flex", padding: 16, marginBottom: 6 }}>
          <Image src="/logo.svg" w={52} h={52} alt="" />
        </motion.div>
        <motion.div variants={rise}>
          <Title order={1} fz={36} fw={700} lts="-0.03em" c="var(--text)">Frederic Coultier</Title>
        </motion.div>
        <motion.div variants={rise}>
          <Text c="dimmed" fz={15} maw={440} lh={1.5}>{t("welcome.tagline")}</Text>
        </motion.div>
        <motion.div variants={rise}>
          <Group gap="sm" justify="center" mt={22} mb={30}>
            <Action primary icon="plus" label={t("welcome.new")} onClick={onNew} />
            <Action icon="folder" label={t("welcome.open")} onClick={onOpen} />
            <Action icon="sparkle" label={t("welcome.sample")} onClick={onSample} />
          </Group>
        </motion.div>
        {recents.length > 0 && (
          <motion.div variants={rise} style={{ width: "min(100%, 520px)", textAlign: "left" }}>
            <Stack gap={8} c="var(--text)">
              <Text className="eyebrow" component="h3" mb={2}>{t("welcome.recent")}</Text>
              {recents.map((r) => (
                <UnstyledButton
                  key={r.path}
                  onClick={() => onOpenRecent(r.path)}
                  className="lift"
                  px={14}
                  py={10}
                  bd="1px solid var(--glass-border)"
                  style={{ borderRadius: 12, minWidth: 0, background: "var(--glass)", display: "flex", gap: 12, alignItems: "center" }}
                >
                  <Box c="var(--accent)" p={8} style={{ display: "flex", borderRadius: 9, background: "var(--accent-soft)", flex: "none" }}><Icon name="cube" size={16} /></Box>
                  <Box style={{ minWidth: 0 }}>
                    <Text fw={600} fz={13.5} truncate="end">{r.name}</Text>
                    <Text c="dimmed" fz={11.5} truncate="end">{r.path}</Text>
                  </Box>
                </UnstyledButton>
              ))}
            </Stack>
          </motion.div>
        )}
      </motion.div>
    </Box>
  );
}
