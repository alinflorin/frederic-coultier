import { useMemo, useRef, useState } from "react";
import { ActionIcon, Box, Checkbox, Group, NumberInput, Slider, Stack, Text, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { humanize, parseParams, setParam, splitUnit } from "../params";
import { getPref, setPref } from "../prefs";
import { Icon } from "./Icon";

/** Sliders for the numeric parameters at the top of the source. Dragging rewrites the number in place. */
export function ParamsPanel({ source, onChange }: { source: string; onChange: (source: string) => void }) {
  const { t } = useTranslation();
  // A guessed range (no hint in the source) is worked out from the value, so it would grow with the
  // value on every drag. Fix it the first time it is seen and only widen it to hold the value.
  const guessed = useRef(new Map<string, { min: number; max: number }>());
  const params = useMemo(
    () =>
      parseParams(source).map((p) => {
        if (p.kind !== "number" || p.hinted) return p;
        const v = p.value as number;
        const kept = guessed.current.get(p.name) ?? { min: p.min, max: p.max };
        const range = { min: Math.min(kept.min, v), max: Math.max(kept.max, v) };
        guessed.current.set(p.name, range);
        return { ...p, ...range };
      }),
    [source],
  );
  // The value each parameter had when it first showed up, so it can be put back with one click.
  const initial = useRef(new Map<string, number | boolean>());
  const names = new Set(params.map((p) => p.name));
  for (const p of params) if (!initial.current.has(p.name)) initial.current.set(p.name, p.value);
  for (const n of [...initial.current.keys()]) if (!names.has(n)) initial.current.delete(n);
  const [open, setOpen] = useState(() => getPref<boolean>("paramsOpen") !== false);
  if (params.length === 0) return null;
  const toggle = () => {
    setPref("paramsOpen", !open);
    setOpen(!open);
  };

  return (
    <Stack gap={0} bd="0 solid var(--hairline)" style={{ flex: "0 1 auto", minHeight: 0, borderBottomWidth: 1 }}>
      <UnstyledButton
        onClick={toggle}
        aria-expanded={open}
        px={14}
        py={9}
        className="eyebrow"
        style={{ flex: "none", width: "100%" }}
      >
        <Group gap={6} wrap="nowrap">
          <Box style={{ display: "flex", transform: open ? undefined : "rotate(-90deg)" }}>
            <Icon name="chevron" size={14} />
          </Box>
          <span>
            {t("params.title")} <Text span inherit c="dimmed">({params.length})</Text>
          </span>
        </Group>
      </UnstyledButton>
      {open && (
        <Stack gap={8} px={14} pb={12} style={{ flex: "0 1 auto", minHeight: 0, maxHeight: 280, overflowY: "auto" }}>
          {params.map((p) => {
            const { base, unit } = splitUnit(p.name);
            const label = humanize(base);
            const was = initial.current.get(p.name);
            const changed = was !== undefined && was !== p.value;
            return (
              <Box
                key={p.name}
                title={p.note || p.name}
                fz={12.5}
                style={{ flex: "none", display: "grid", gridTemplateColumns: "minmax(80px, 1.1fr) minmax(80px, 1.4fr) 88px 22px", alignItems: "center", gap: 8 }}
              >
                <Text component="label" htmlFor={`param-${p.name}`} inherit truncate>
                  {label}
                  {p.note && <Text span inherit c="dimmed"> {p.note}</Text>}
                </Text>
                {p.kind === "bool" ? (
                  <>
                    <Checkbox id={`param-${p.name}`} checked={p.value as boolean} onChange={(e) => onChange(setParam(source, p, e.currentTarget.checked))} />
                    <span />
                  </>
                ) : (
                  <>
                    <Slider
                      id={`param-${p.name}`}
                      size="sm"
                      label={null}
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={p.value as number}
                      onChange={(v) => onChange(setParam(source, p, v))}
                    />
                    <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                      <NumberInput
                        size="xs"
                        variant="filled"
                        hideControls
                        styles={{ input: { background: "var(--surface-2)", border: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 550 } }}
                        step={p.step}
                        value={p.value as number}
                        aria-label={label}
                        style={{ flex: 1, width: 0 }}
                        onChange={(v) => typeof v === "number" && Number.isFinite(v) && onChange(setParam(source, p, v))}
                      />
                      <Text c="dimmed" fz={12} w={24} style={{ flex: "none" }}>{unit}</Text>
                    </Group>
                  </>
                )}
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size={22}
                  style={{ visibility: changed ? "visible" : "hidden" }}
                  tabIndex={changed ? 0 : -1}
                  title={t("params.reset", { value: String(was) })}
                  aria-label={t("params.reset", { value: String(was) })}
                  onClick={() => was !== undefined && onChange(setParam(source, p, was))}
                >
                  <Icon name="rotate" size={13} />
                </ActionIcon>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
