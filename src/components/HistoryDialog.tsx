import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Group, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { diffStats, lineDiff, sameDesign } from "../history";
import type { FcProject } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { labelSchema } from "../validation";

export function HistoryDialog({
  project,
  onSnapshot,
  onRestore,
  onDelete,
  onRename,
  onClose,
}: {
  project: FcProject;
  onSnapshot: (label: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const compact = useMediaQuery("(max-width: 899px)");
  const list = useMemo(() => [...project.history].reverse(), [project.history]);
  const [selected, setSelected] = useState<string | null>(list[0]?.id ?? null);
  const rules = useMemo(() => labelSchema(t), [t]);
  // the names are checked when the field was touched and left, and again when taking or renaming
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const take = useForm<{ label: string }>({ defaultValues: { label: "" }, resolver: zodResolver(rules) as any, mode: "onTouched" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rename = useForm<{ label: string }>({ defaultValues: { label: "" }, resolver: zodResolver(rules) as any, mode: "onTouched" });
  const takeSnapshot = take.handleSubmit((v) => {
    onSnapshot(v.label);
    take.reset({ label: "" });
  });
  // window.prompt is not available in the desktop webview, so renaming happens inline
  const [renaming, setRenaming] = useState<string | null>(null);
  const snap = list.find((s) => s.id === selected) ?? null;
  const diff = useMemo(() => (snap ? lineDiff(snap.source, project.source) : []), [snap, project.source]);
  const stats = diffStats(diff);
  const same = snap ? sameDesign(snap, project) : false;
  const when = (ms: number) => new Date(ms).toLocaleString();
  const name = (s: (typeof list)[number]) => s.label || t(`history.kind.${s.kind}`);

  return (
    <Dialog
      title={t("history.title")}
      wide
      fixed
      onClose={onClose}
      footer={
        <>
          <Controller
            control={take.control}
            name="label"
            render={({ field, fieldState }) => (
              <TextInput
                flex={1}
                {...field}
                placeholder={t("history.namePlaceholder")}
                error={fieldState.isTouched ? fieldState.error?.message : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void takeSnapshot();
                }}
              />
            )}
          />
          <Button leftSection={<Icon name="plus" />} onClick={() => void takeSnapshot()}>
            {t("history.take")}
          </Button>
        </>
      }
    >
      {list.length === 0 ? (
        <Text c="dimmed">{t("history.empty")}</Text>
      ) : (
        <Box style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(180px, 240px) 1fr", gap: 14, minHeight: 0, height: "100%" }}>
          <Stack gap={4} aria-label={t("history.title")} style={{ overflowY: "auto", minHeight: 0 }}>
            {list.map((s) => (
              <UnstyledButton
                key={s.id}
                onClick={() => setSelected(s.id)}
                className="choice"
                data-on={s.id === selected}
                style={{ padding: "8px 11px" }}
              >
                <Text fw={700} inherit>{name(s)}</Text>
                <Text c="dimmed" inherit>
                  {when(s.time)} · {t(`history.kind.${s.kind}`)}
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
          {snap && (
            <Stack gap={8} style={{ minWidth: 0, minHeight: 0, overflowY: "auto" }}>
              <Group gap={8}>
                <Button
                  disabled={same}
                  onClick={() => {
                    onRestore(snap.id);
                    onClose();
                  }}
                >
                  {t("history.restore")}
                </Button>
                <Button variant="default" onClick={() => {
                  rename.reset({ label: snap.label });
                  setRenaming(snap.label);
                }}>{t("history.renameAction")}</Button>
                <Button variant="default" onClick={() => onDelete(snap.id)}>{t("history.delete")}</Button>
              </Group>
              {renaming !== null && (
                <Controller
                  control={rename.control}
                  name="label"
                  render={({ field, fieldState }) => (
                    <TextInput
                      data-autofocus
                      {...field}
                      aria-label={t("history.rename")}
                      error={fieldState.isTouched ? fieldState.error?.message : undefined}
                      onBlur={() => {
                        field.onBlur();
                        // leaving the field with a valid name closes it; an invalid one stays, with its message, to be fixed
                        void rename.trigger("label").then((ok) => ok && setRenaming(null));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void rename.handleSubmit((v) => {
                            onRename(snap.id, v.label);
                            setRenaming(null);
                          })();
                        } else if (e.key === "Escape") {
                          e.stopPropagation();
                          setRenaming(null);
                        }
                      }}
                    />
                  )}
                />
              )}
              <Text c="dimmed">
                {same ? t("history.same") : t("history.changes", { added: stats.added, removed: stats.removed })}
              </Text>
              {!same && stats.added + stats.removed > 0 && (
                <Box component="pre" aria-label={t("history.diff")} m={0} p="8px 10px" fz={12} bg="var(--code-bg)" bd="1px solid var(--border)" style={{ borderRadius: 8, overflow: "auto", maxHeight: 360, lineHeight: 1.5 }}>
                  {diff.map((l, i) => (
                    <Box
                      key={i}
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        background: l.op === "+" ? "color-mix(in srgb, var(--ok) 20%, transparent)" : l.op === "-" ? "color-mix(in srgb, var(--bad) 20%, transparent)" : undefined,
                      }}
                    >
                      {l.op} {l.text}
                    </Box>
                  ))}
                </Box>
              )}
              {!same && stats.added + stats.removed === 0 && <Text c="dimmed">{t("history.settingsOnly")}</Text>}
            </Stack>
          )}
        </Box>
      )}
    </Dialog>
  );
}
