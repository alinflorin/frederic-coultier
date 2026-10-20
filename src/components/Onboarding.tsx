import { useState } from "react";
import { Box, Button, Code, Group, Image, List, Modal, SegmentedControl, SimpleGrid, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { THEMES, getTheme, setTheme, type Theme } from "../theme";
import { Icon } from "./Icon";
import { Check, Section } from "./form";

export type RunMode = "chat" | "mcp";

/** First-run walkthrough: what the app is, then how the user wants to drive it. */
export function Onboarding({
  chatAvailable,
  onRefresh,
  onDone,
}: {
  /** False once we know neither Claude Code nor Codex is signed in; null while still looking. */
  chatAvailable: boolean | null;
  /** Looks for signed-in agents again, after the user followed the sign-in steps. */
  onRefresh: () => void;
  onDone: (mode: RunMode, allTools: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [mode, setMode] = useState<RunMode>("chat");
  const [allTools, setAllTools] = useState(false);
  const chatBlocked = chatAvailable === false;
  const chosen: RunMode = chatBlocked ? "mcp" : mode;

  return (
    <Modal
      opened
      onClose={() => {}}
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={false}
      centered
      size={640}
      zIndex={400}
      overlayProps={{ backgroundOpacity: 1, blur: 22, color: "var(--overlay)" }}
      aria-label={t("onboarding.title")}
    >
      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}>
      {step === 0 ? (
        <Stack gap={0}>
          <Title order={2} fz={18} mb={4}>{t("onboarding.lookTitle")}</Title>
          <Section>{t("language")}</Section>
          <SegmentedControl
            aria-label={t("language")}
            value={i18n.resolvedLanguage ?? SUPPORTED_LANGUAGES[0]}
            data={SUPPORTED_LANGUAGES.map((l: Language) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
            onChange={(l) => setLanguage(l as Language)}
          />
          <Section>{t("prefs.theme")}</Section>
          <SegmentedControl
            aria-label={t("prefs.theme")}
            value={theme}
            data={THEMES.map((th) => ({ value: th, label: t(`prefs.themes.${th}`) }))}
            onChange={(th) => {
              setThemeState(th as Theme);
              setTheme(th as Theme);
            }}
          />
        </Stack>
      ) : step === 1 ? (
        <Stack align="center" ta="center" gap="xs" px="md" py="lg">
          <Image src="/logo.svg" w={64} h={64} alt="" />
          <Title order={1} fz={26} fw={600}>{t("onboarding.title")}</Title>
          <Text maw={460}>{t("onboarding.about1")}</Text>
          <Text maw={460} c="dimmed">{t("onboarding.about2")}</Text>
        </Stack>
      ) : (
        <Stack gap={8}>
          <Title order={2} fz={18}>{t("onboarding.modeTitle")}</Title>
          <Text fz={12} c="dimmed">{t("onboarding.modeHint")}</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={12} my={12} role="radiogroup">
            {(["chat", "mcp"] as const).map((id) => {
              const disabled = id === "chat" && chatBlocked;
              const on = chosen === id;
              return (
                <UnstyledButton
                  key={id}
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => setMode(id)}
                  className="choice"
                  data-on={on}
                  p={16}
                  style={{ opacity: disabled ? 0.45 : 1 }}
                >
                  <Stack gap={8}>
                    <Group gap={8} c="var(--accent)">
                      <Icon name={id === "chat" ? "chat" : "code"} size={20} />
                      <Text span fw={700} fz={15} c="var(--text)">{t(`onboarding.${id}.name`)}</Text>
                      {id === "chat" && <Text span fz={11} px={7} bg="var(--accent)" c="var(--accent-text)" style={{ borderRadius: 99 }}>{t("onboarding.recommended")}</Text>}
                    </Group>
                    <Text inherit>{t(`onboarding.${id}.what`)}</Text>
                    <Text inherit c="dimmed">{t(`onboarding.${id}.how`)}</Text>
                    {disabled && <Text inherit c="var(--accent)">{t("chat.noAgent")}</Text>}
                  </Stack>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
          {chatBlocked && (
            <Stack gap={6} fz={13}>
              <Text fw={700} inherit>{t("onboarding.signin.title")}</Text>
              <List type="ordered" fz={13}>
                <List.Item>{t("onboarding.signin.step1")}</List.Item>
                <List.Item>
                  <Code>claude auth login</Code> {t("onboarding.signin.or")} <Code>codex login</Code>
                </List.Item>
                <List.Item>{t("onboarding.signin.step3")}</List.Item>
              </List>
              <Box><Button type="button" variant="default" size="xs" onClick={onRefresh}>{t("onboarding.signin.check")}</Button></Box>
            </Stack>
          )}
          {chosen === "chat" && !chatBlocked && (
            <>
              <Check checked={allTools} onChange={setAllTools} label={t("prefs.chat.allTools")} />
              <Text fz={12} c="dimmed">{t("prefs.chat.allToolsHint")}</Text>
            </>
          )}
          <Text fz={12} c="dimmed">{t("onboarding.later")}</Text>
        </Stack>
      )}
      </motion.div>
      </AnimatePresence>
      <Group gap={8} mt="md" justify="flex-end" wrap="nowrap">
        <Group gap={6} mr="auto" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.div key={i} animate={{ width: step === i ? 22 : 8, background: step === i ? "var(--accent)" : "var(--border-strong)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} style={{ height: 8, borderRadius: 99 }} />
          ))}
        </Group>
        {step > 0 && <Button variant="default" onClick={() => setStep((step - 1) as 0 | 1)}>{t("onboarding.back")}</Button>}
        {step < 2 ? (
          <Button onClick={() => setStep((step + 1) as 1 | 2)}>{t("onboarding.next")}</Button>
        ) : (
          <Button onClick={() => onDone(chosen, chosen === "chat" && allTools)}>{t("onboarding.start")}</Button>
        )}
      </Group>
    </Modal>
  );
}
