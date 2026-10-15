import type { FcProject } from "./types";

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
    },
    hollow: { enabled: false, wall: 1, drain: 1 },
    sprue: false,
  },
  optimization: { simplify: false, keepPercent: 60, maxVolumeChange: 0.5 },
};

const SOURCE = `// Solitaire ring, 4 prong
// Parameters
ring_size_mm  = 17.3;   // inner diameter (EU 54)
band_width    = 2.4;
band_thick    = 1.6;
stone_d       = 5.0;    // round brilliant
prong_d       = 0.9;
prongs        = 4;

$fn = 128;

module band() {
  difference() {
    cylinder(d = ring_size_mm + 2 * band_thick, h = band_width, center = true);
    cylinder(d = ring_size_mm, h = band_width + 1, center = true);
  }
}

module head() {
  translate([0, 0, ring_size_mm / 2 + band_thick]) {
    // basket
    cylinder(d1 = 3, d2 = stone_d + 0.4, h = 2.2);
    // prongs
    for (i = [0 : prongs - 1])
      rotate([0, 0, i * 360 / prongs + 45])
        translate([stone_d / 2 + 0.1, 0, 0])
          cylinder(d = prong_d, h = 4);
  }
}

union() {
  band();
  head();
}
`;

export function sampleProject(): FcProject {
  return {
    formatVersion: 1,
    settings: {
      ...DEFAULT_SETTINGS,
      general: { name: "Solitaire ring", notes: "EU 54, 5 mm centre stone." },
      printing: {
        ...DEFAULT_SETTINGS.printing,
        supports: { ...DEFAULT_SETTINGS.printing.supports, enabled: true },
      },
    },
    source: SOURCE,
    chat: [
      {
        id: "1",
        role: "user",
        text: "A simple solitaire ring with four prongs for a 5 mm round stone, size EU 54.",
      },
      {
        id: "2",
        role: "assistant",
        text: "Here's a first draft: a 2.4 mm wide, 1.6 mm thick band with a tapered basket and four 0.9 mm prongs. The prongs sit just outside the girdle so the stone can be set from above. Want a thinner shank or a tapered band?",
        change: { added: 38, removed: 0 },
      },
    ],
    supportCount: { auto: 14, manual: 2 },
  };
}

export function emptyProject(name: string): FcProject {
  return {
    formatVersion: 1,
    settings: { ...DEFAULT_SETTINGS, general: { name, notes: "" } },
    source: "// New project\n$fn = 128;\n",
    chat: [],
    supportCount: { auto: 0, manual: 0 },
  };
}
