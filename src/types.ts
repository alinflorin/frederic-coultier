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

/** A share of a time window of the account's plan that is used up. */
export interface Limit {
  /** "5h", "weekly". */
  label: string;
  /** 0 to 100. */
  percent: number;
  /** Unix seconds when it starts over. */
  resetsAt: number | null;
}

/** A file attached to a message. */
export interface Attached {
  name: string;
  mime: string;
  /** Base64. */
  data?: string;
}

export interface ChatMessage {
  id: string;
  /** `note` is the app speaking (e.g. "conversation compacted"), not either side. */
  role: "user" | "assistant" | "note";
  text: string;
  /** User only: files sent along.  */
  files?: Attached[];
  /** Assistant only: what the agent thought while answering, if it showed it. */
  thinking?: string;
  /** Assistant only: the tools it used while answering, for display. */
  tools?: ToolCall[];
  /** Assistant only: summary of the change made to the source. */
  change?: { added: number; removed: number };
}

/** One conversation with an agent, and what the agent needs to carry on with it. */
export interface ChatLog {
  id: string;
  /** Shown in the list; made from the first question until there is one. */
  title: string;
  /** Milliseconds since 1970 of the last change. */
  updated: number;
  messages: ChatMessage[];
  /** The agent's own id for the conversation; only that agent can continue it. */
  session?: { engine: string; id: string };
  /** How much of the agent's memory the conversation takes up, as of its last answer. */
  context?: { engine: string; used: number; window: number };
  /** What was kept when the conversation was compacted. */
  summary?: string;
  /** Compact this conversation by itself when its memory fills up; off unless set. */
  autoCompact?: boolean;
}

/** All the conversations of a project. Saved in the .fc file, and also kept by the app. */
export interface ChatBook {
  /** The one on show. */
  active: string;
  list: ChatLog[];
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

export type SnapshotKind = "manual" | "save" | "agent" | "restore";

/** One saved state of the design: what is needed to put it back. */
export interface Snapshot {
  id: string;
  kind: SnapshotKind;
  /** Name given by the user, or what the app was about to do ("Before agent change"). */
  label: string;
  /** Milliseconds since 1970. */
  time: number;
  source: string;
  settings: ProjectSettings;
  supports: SupportsData;
}

export interface FcProject {
  formatVersion: 1;
  settings: ProjectSettings;
  source: string; // model.scad
  supports: SupportsData;
  /** Saved whole in the file, attachments and tool results included. */
  chats: ChatBook;
  /** Version history, oldest first. Saved in the file. */
  history: Snapshot[];
}
