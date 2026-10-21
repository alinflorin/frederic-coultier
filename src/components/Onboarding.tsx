import { useState } from "react";
import { Box, Button, Code, Group, Image, List, Modal, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { THEMES, getTheme, setTheme, type Theme } from "../theme";
import { Check, Section } from "./form";

/** First-run walkthrough: what the app is, then the agent it talks to. */
export function Onboarding({
  chatAvailable,
  onRefresh,
  onDone,
}: {
  /** False once we know neither Claude Code nor Codex is signed in; null while still looking. */
  chatAvailable: boolean | null;
  /** Looks for signed-in agents again, after the user followed the sign-in steps. */
  onRefresh: () => void;
  onDone: (allTools: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [allTools, setAllTools] = useState(false);
  const chatBlocked = chatAvailable === false;

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
          <Title order={2} fz={18}>{t("onboarding.agentTitle")}</Title>
          <Text fz={13}>{t("onboarding.agentWhat")}</Text>
          <Text fz={12} c="dimmed">{t("onboarding.agentHow")}</Text>
          <Text fz={13} fw={700} mt={6}>{t("onboarding.rhinoTitle")}</Text>
          <Text fz={12} c="dimmed">{t("onboarding.rhinoHow")}</Text>
          {chatBlocked && (
            <Stack gap={6} fz={13} mt={6}>
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
          {!chatBlocked && (
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
          <Button onClick={() => onDone(!chatBlocked && allTools)}>{t("onboarding.start")}</Button>
        )}
      </Group>
    </Modal>
  );
}
