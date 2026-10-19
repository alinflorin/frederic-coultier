import type { TFunction } from "i18next";
import { z } from "zod";

/**
 * Validation rules for the forms of the app. The messages are translated, so each schema is built
 * from the current `t` (see `useSchema`); the forms show a message once its field was touched and left.
 */

/** A number between `min` and `max`; an empty or non-numeric field is "required"/"not a number". */
export function range(t: TFunction, min: number, max: number, opts: { int?: boolean } = {}) {
  let n = z
    .number({ error: (i) => (i.input === "" || i.input === undefined || i.input === null ? t("validation.required") : t("validation.number")) })
    .min(min, { error: t("validation.min", { min }) })
    .max(max, { error: t("validation.max", { max }) });
  if (opts.int) n = n.int({ error: t("validation.integer") });
  return n;
}

const loose = z.looseObject;

/** The project settings dialog. Unknown keys pass through untouched. */
export function settingsSchema(t: TFunction) {
  const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: t("validation.color") });
  return loose({
    render: loose({ metalColor: hex, previewQuality: range(t, 12, 256, { int: true }) }),
    printing: loose({
      minWall: range(t, 0.2, 3),
      tilt: range(t, 0, 60),
      supports: loose({
        tipRadius: range(t, 0.1, 1),
        baseRadius: range(t, 0.2, 2),
        overhangAngle: range(t, 0, 80),
        spacing: range(t, 1, 10),
        raftRadius: range(t, 0, 10),
        raftThickness: range(t, 0, 10),
        lift: range(t, 1, 10),
      }).superRefine((s, ctx) => {
        if (typeof s.raftThickness === "number" && typeof s.lift === "number" && s.raftThickness > Math.max(0, s.lift - 0.1)) {
          ctx.addIssue({ code: "custom", path: ["raftThickness"], message: t("validation.thinnerThanLift", { max: Math.max(0, s.lift - 0.1).toFixed(1) }) });
        }
      }),
      hollow: loose({ wall: range(t, 0.4, 3), drain: range(t, 0.5, 3) }),
      sprueDiameter: range(t, 0.5, 6),
      sprueLength: range(t, 1, 20),
    }),
    optimization: loose({ keepPercent: range(t, 1, 99, { int: true }), maxVolumeChange: range(t, 0.1, 5) }),
  });
}

/** Host and port of the MCP server. */
export function mcpSchema(t: TFunction) {
  return z.object({
    host: z.string().trim().min(1, { error: t("validation.required") }).regex(/^[A-Za-z0-9.:-]+$/, { error: t("prefs.mcp.badHost") }),
    port: z
      .string()
      .trim()
      .min(1, { error: t("validation.required") })
      .regex(/^\d+$/, { error: t("prefs.mcp.badPort") })
      .refine((v) => Number(v) >= 1 && Number(v) <= 65535, { error: t("prefs.mcp.badPort") }),
  });
}

/** After how many seconds a long round ends with a chime. */
export const chimeSchema = (t: TFunction) => z.object({ secs: range(t, 0, 3600, { int: true }) });

/** The optional name of a version in the history. */
export const LABEL_MAX = 60;
export const labelSchema = (t: TFunction) => z.object({ label: z.string().trim().max(LABEL_MAX, { error: t("validation.labelMax", { max: LABEL_MAX }) }) });
