// Shape of the contents of a `.fc` project file. The container format itself
// (zip, sqlite, ...) is not decided yet; the UI only works with this model.

export type Metal =
  | "silver925"
  | "gold18y"
  | "gold18r"
  | "gold18w"
  | "platinum"
  | "resin";

export type Finish = "polished" | "satin" | "matte";
export type ShadingMode = "shaded" | "edges" | "wireframe" | "xray";
export type ExportFormat = "stl-bin" | "stl-ascii" | "obj" | "3mf";

export interface ProjectSettings {
  general: {
    name: string;
    notes: string;
  };
  material: {
    metal: Metal;
    process: "direct" | "casting";
  };
  render: {
    metalColor: string;
    gemColor: string;
    finish: Finish;
    shading: ShadingMode;
    orthographic: boolean;
    previewQuality: number; // $fn used while sketching
  };
  printing: {
    printer: string;
    minWall: number; // mm
    tilt: number; // degrees
    supports: {
      enabled: boolean;
      tipRadius: number;
      baseRadius: number;
      overhangAngle: number;
      spacing: number;
      raftRadius: number;
      raftThickness: number; // mm, 0 = no raft
      lift: number; // mm between the piece and the plate
    };
    hollow: { enabled: boolean; wall: number; drain: number };
    sprue: boolean;
    sprueDiameter: number;
    sprueLength: number;
  };
  optimization: {
    simplify: boolean;
    keepPercent: number;
    maxVolumeChange: number; // percent
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Assistant only: summary of the change made to the source. */
  change?: { added: number; removed: number };
}

/** One support contact point, in the model's own coordinates. */
export interface Support {
  id: number;
  x: number;
  y: number;
  z: number;
  source: "auto" | "manual";
  tip?: number;
}

export interface SupportsData {
  list: Support[];
  nextId: number;
}

export interface FcProject {
  formatVersion: 1;
  settings: ProjectSettings;
  source: string; // model.scad
  chat: ChatMessage[];
  supports: SupportsData;
}
