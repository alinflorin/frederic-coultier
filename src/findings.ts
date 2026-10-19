import type { TFunction } from "i18next";
import type { Finding } from "./api";

/** Findings carry either one value or "a|b|c|d|e"; the translations use whichever names they need. */
export function findingParams(detail: string) {
  const [a, b, c, d, e] = detail.split("|");
  return { detail, n: a, min: b, area: c, limit: d, worst: a, reach: b, vol: b, massArea: b, massLimit: c, a, b, c, d, e };
}

export const findingText = (t: TFunction, f: Finding) => t(`findings.${f.code}`, findingParams(f.detail));
