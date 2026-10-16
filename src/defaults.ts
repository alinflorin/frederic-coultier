import type { FcProject } from "./types";
import sampleScad from "./sample.scad?raw";

export const DEFAULT_SETTINGS: FcProject["settings"] = {
  general: { name: "Untitled", notes: "" },
  material: { metal: "silver925", process: "casting" },
  render: {
    metalColor: "#cfd2d6",
    gemColor: "#7fd4f2",
    finish: "polished",
    shading: "shaded",
    orthographic: false,
    previewQuality: 48,
  },
  printing: {
    printer: "Elegoo Mars 5",
    minWall: 0.6,
    tilt: 30,
    supports: {
      enabled: false,
      tipRadius: 0.2,
      baseRadius: 0.5,
      overhangAngle: 45,
      spacing: 4,
      raftRadius: 3,
      raftThickness: 1,
      lift: 3,
    },
    hollow: { enabled: false, wall: 1, drain: 1 },
    sprue: false,
    sprueDiameter: 2,
    sprueLength: 5,
    sprueAt: null,
  },
  optimization: { simplify: false, keepPercent: 60, maxVolumeChange: 0.5 },
};

export function emptyProject(name: string): FcProject {
  return {
    formatVersion: 1,
    settings: { ...DEFAULT_SETTINGS, general: { ...DEFAULT_SETTINGS.general, name } },
    source: "// New project\n$fn = 128;\n",
    chat: { messages: [] },
    supports: { list: [], nextId: 1 },
  };
}

/** A ready-made example so there is something to look at. */
export function sampleProject(): FcProject {
  return {
    ...emptyProject("Solitaire ring"),
    settings: {
      ...DEFAULT_SETTINGS,
      general: { name: "Solitaire ring", notes: "EU 54, 5 mm centre stone." },
    },
    source: sampleScad,
    chat: { messages: [
      { id: "1", role: "user", text: "A simple solitaire ring with four prongs for a 5 mm round stone, size EU 54." },
      {
        id: "2",
        role: "assistant",
        text: "Here's a first draft: a 2.4 mm wide, 1.6 mm thick band with a tapered basket and four 0.9 mm prongs. Want a thinner shank or a tapered band?",
        change: { added: 38, removed: 0 },
      },
    ] },
  };
}
