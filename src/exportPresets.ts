import type { ExportPick } from "./components/ExportDialog";
import type { ExportFormat, FcProject } from "./types";

/** A one-click way to export for a particular printer: format, which steps run, and what to tell the user. */
export interface ExportPreset {
  id: string;
  format: ExportFormat;
  /** Build plate in mm (x, y, z), for the fit check. */
  bed?: [number, number, number];
  /** Which export steps to switch on for this project. */
  pick: (p: FcProject, canSupports: boolean) => ExportPick;
  /** Slicer settings worth setting, shown as hints (translation keys under `export.preset.<id>.`). */
  hints: string[];
}

const casting = (p: FcProject) => p.settings.material.process === "casting";

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "mars5",
    format: "stl-bin",
    bed: [153.4, 77, 150],
    // Exact geometry (no simplifying: the 4K screen resolves ~0.05 mm), supports baked in when they
    // exist, a sprue for casting masters. Casting masters are burned out, so they stay solid; a
    // directly printed piece may be hollowed if the project asks for it.
    pick: (p, canSupports) => ({
      supports: canSupports,
      simplify: false,
      sprue: casting(p),
      hollow: !casting(p) && p.settings.printing.hollow.enabled,
    }),
    hints: ["layer", "orientation", "slicer"],
  },
];

export const presetById = (id: string | null | undefined) => EXPORT_PRESETS.find((x) => x.id === id) ?? null;
