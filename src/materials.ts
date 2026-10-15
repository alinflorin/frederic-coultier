import type { Finish, Metal } from "./types";

/** g/cm³ */
export const DENSITY: Record<Metal, number> = {
  silver925: 10.36,
  gold18y: 15.5,
  gold18r: 15.0,
  gold18w: 14.7,
  platinum: 21.4,
  resin: 1.1,
};

/** PBR roughness per surface finish. */
export const ROUGHNESS: Record<Finish, number> = {
  polished: 0.1,
  satin: 0.36,
  matte: 0.68,
};
