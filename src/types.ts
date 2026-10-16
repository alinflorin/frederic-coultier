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
    /** Manual sprue spot in model coordinates; null = placed automatically. */
    sprueAt: [number, number, number] | null;
  };
  optimization: {
    simplify: boolean;
    keepPercent: number;
    maxVolumeChange: number; // percent
  };
}

export type ToolPart = { type: "text"; text: string } | { type: "image"; mime: string; data: string };

/** One use of a tool by the agent: what it asked and what came back. */
export interface ToolCall {
  id: string;
  name: string;
  input: string;
  output: ToolPart[];
  error: boolean;
  done: boolean;
}

/** A file attached to a message. */
export interface Attached {
  name: string;
  mime: string;
  /** Base64; dropped from the saved conversation unless it is a picture. */
  data?: string;
}

export interface ChatMessage {
  id: string;
  /** `note` is the app speaking (e.g. "conversation compacted"), not either side. */
  role: "user" | "assistant" | "note";
  text: string;
  /** User only: files sent along. Pictures keep their bytes (base64) so they can be shown again. */
  files?: Attached[];
  /** Assistant only: the tools it used while answering, for display. */
  tools?: ToolCall[];
  /** Assistant only: summary of the change made to the source. */
  change?: { added: number; removed: number };
}

/** The conversation about a project, and what the agent needs to carry on with it. Kept by the app, not in the .fc file. */
export interface ChatLog {
  messages: ChatMessage[];
  /** The agent's own id for the conversation; only that agent can continue it. */
  session?: { engine: string; id: string };
  /** What was kept when the conversation was compacted. */
  summary?: string;
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
  supports: SupportsData;
}
