import type { ReactNode } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Checkbox, ColorInput, Fieldset, Flex, NativeSelect, NumberInput, Paper, Stack, Text, TextInput, Title } from "@mantine/core";

/** A small uppercase heading that starts a group of settings in a dialog. */
export function Section({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <Title order={4} fz={12} fw={600} tt="uppercase" lts="0.06em" c="dimmed" mt={first ? 0 : 18} mb={8}>
      {children}
    </Title>
  );
}

/** A secondary line of explanation. */
export function Note({ children }: { children: ReactNode }) {
  return <Text fz={12} c="dimmed" mt={6} mb={0} style={{ overflowWrap: "anywhere" }}>{children}</Text>;
}

/** A label on the left and its control on the right (stacked on a narrow window). */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <Stack gap={2} py={5}>
      <Flex direction={{ base: "column", md: "row" }} align={{ base: "stretch", md: "center" }} gap={{ base: 4, md: 12 }}>
        <Text component="label" w={{ md: 170 }} style={{ flex: "none" }}>{label}</Text>
        <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }} wrap="wrap">{children}</Flex>
      </Flex>
      {error ? (
        <Text fz={12} c="var(--bad)" role="alert" ml={{ md: 182 }}>{error}</Text>
      ) : (
        hint && <Text fz={12} c="dimmed" ml={{ md: 182 }}>{hint}</Text>
      )}
    </Stack>
  );
}

/** A number with an optional unit after it. */
export function Num({
  value,
  onChange,
  onBlur,
  step = 0.1,
  unit,
  w = 110,
  disabled,
  invalid,
}: {
  value: number | string;
  /** Gets what was typed: a number, or "" when the field is empty. */
  onChange: (v: number | string) => void;
  onBlur?: () => void;
  step?: number;
  unit?: string;
  w?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <Flex align="center" gap={6} wrap="nowrap">
      <NumberInput
        w={w}
        size="xs"
        value={value}
        step={step}
        disabled={disabled}
        error={invalid}
        clampBehavior="none"
        onChange={onChange}
        onBlur={onBlur}
      />
      {unit && <Text span c="dimmed">{unit}</Text>}
    </Flex>
  );
}

export function Check({
  checked,
  onChange,
  label,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Checkbox
      py={5}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.currentTarget.checked)}
      label={
        <>
          {label}
          {children}
        </>
      }
    />
  );
}

/** A group of fields that is greyed out and disabled unless `on`. */
export function Enabled({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <Fieldset variant="unstyled" disabled={!on} p={0} style={{ opacity: on ? 1 : 0.45, minWidth: 0 }}>
      {children}
    </Fieldset>
  );
}

/** A figure with its caption, in a tinted box. */
export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper flex={1} px={12} py={10} bg="var(--surface-2)" radius="md">
      <Stack gap={0}>
        <Text c="dimmed" fz={12}>{label}</Text>
        <Text fw={700} fz={18}>{value}</Text>
        {sub && <Text c="dimmed" fz={12}>{sub}</Text>}
      </Stack>
    </Paper>
  );
}

// Fields bound to a react-hook-form form. A message shows once the field was touched and left.
const shown = (f: { isTouched: boolean; error?: { message?: string } }) => (f.isTouched ? f.error?.message : undefined);

export function NumField<T extends FieldValues>({ control, name, label, hint, unit, step, w, disabled }: { control: Control<T>; name: Path<T>; label: string; hint?: string; unit?: string; step?: number; w?: number; disabled?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={shown(fieldState)}>
          <Num value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} step={step} unit={unit} w={w} disabled={disabled} invalid={!!shown(fieldState)} />
        </Field>
      )}
    />
  );
}

export function TextField<T extends FieldValues>({ control, name, label, hint, placeholder }: { control: Control<T>; name: Path<T>; label: string; hint?: string; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={shown(fieldState)}>
          <TextInput size="xs" flex={1} spellCheck={false} placeholder={placeholder} error={!!shown(fieldState)} {...field} value={field.value ?? ""} />
        </Field>
      )}
    />
  );
}

export function ColorField<T extends FieldValues>({ control, name, label }: { control: Control<T>; name: Path<T>; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} error={shown(fieldState)}>
          <ColorInput size="xs" w={130} format="hex" error={!!shown(fieldState)} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
        </Field>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, hint, data }: { control: Control<T>; name: Path<T>; label: string; hint?: string; data: { value: string; label: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={shown(fieldState)}>
          <NativeSelect size="xs" data={data} value={field.value ?? ""} onChange={(e) => field.onChange(e.currentTarget.value)} onBlur={field.onBlur} />
        </Field>
      )}
    />
  );
}

export function CheckField<T extends FieldValues>({ control, name, label }: { control: Control<T>; name: Path<T>; label: ReactNode }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Check checked={!!field.value} onChange={field.onChange} label={label} />}
    />
  );
}
