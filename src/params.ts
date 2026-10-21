// Parameter sliders: the top-level `name = number` (or `True`/`False`) lines of the design script
// (RhinoScript, Python), with an optional range in the trailing comment:
//
//   band_width = 2.4   # width of the band [1:0.1:6]
//   prongs     = 4     # [3:8]
//   pave       = True

export interface Param {
  name: string;
  kind: "number" | "bool";
  value: number | boolean;
  min: number;
  max: number;
  step: number;
  /** The comment next to the line, without the range. */
  note: string;
  /** Where the literal sits in the source. */
  start: number;
  end: number;
  /** Digits kept after the decimal point when the value is written back. */
  decimals: number;
  /** The range comes from a `[min:step:max]` comment; otherwise it is a guess from the value. */
  hinted: boolean;
}

const ASSIGN = /^()([A-Za-z_]\w*)(\s*=\s*)(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|True|False)(\s*;?)(.*)$/;
const RANGE = /\[\s*(-?[\d.]+)\s*:\s*(?:(-?[\d.]+)\s*:\s*)?(-?[\d.]+)\s*\]/;

const decimalsOf = (text: string) => {
  const m = /\.(\d+)/.exec(text);
  return m ? m[1].length : 0;
};

/** Strips comments and strings from one line of Python, tracking triple-quoted strings across lines. */
function code(line: string, state: { triple: string | null }): string {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    if (state.triple) {
      const at = line.indexOf(state.triple, i);
      if (at < 0) break;
      i = at + 2;
      state.triple = null;
      continue;
    }
    const c = line[i];
    if (c === "#") break;
    if (c === '"' || c === "'") {
      if (line.startsWith(c.repeat(3), i)) {
        state.triple = c.repeat(3);
        i += 2;
        continue;
      }
      i++;
      while (i < line.length && line[i] !== c) i += line[i] === "\\" ? 2 : 1;
      continue;
    }
    out += c;
  }
  return out;
}

/** The slider for one assignment line, or null when the numbers do not make a usable range. */
function fromLine(m: RegExpExecArray, offset: number): Param | null {
  const [, indent, name, eq, literal, , rest] = m;
  const start = offset + indent.length + name.length + eq.length;
  const end = start + literal.length;
  const comment = /#(.*)$/.exec(rest)?.[1] ?? "";
  const range = RANGE.exec(comment);
  const note = comment.replace(RANGE, "").trim();
  if (literal === "True" || literal === "False") {
    return { name, kind: "bool", value: literal === "True", min: 0, max: 1, step: 1, note, start, end, decimals: 0, hinted: true };
  }
  const value = Number(literal);
  const own = decimalsOf(literal);
  let min: number, max: number, step: number;
  if (range) {
    min = Number(range[1]);
    max = Number(range[3]);
    step = range[2] !== undefined ? Number(range[2]) : own > 0 || !Number.isInteger(min) ? 0.1 : 1;
  } else {
    // no hint: from 0 (or down to -3x) up to 3x the value, in steps as fine as the literal
    step = own > 0 ? 10 ** -Math.min(own, 2) : 1;
    const reach = value === 0 ? 10 : Math.abs(value) * 3;
    min = value < 0 ? -reach : own === 0 && value >= 1 ? 1 : 0;
    max = value < 0 ? 0 : reach;
  }
  if (!(step > 0) || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;
  const decimals = Math.max(decimalsOf(String(step)), own);
  const tidy = (n: number) => Number(n.toFixed(decimals));
  return { name, kind: "number", value, min: tidy(Math.min(min, value)), max: tidy(Math.ceil(Math.max(max, value) / step) * step), step, note, start, end, decimals, hinted: !!range };
}

export function parseParams(source: string): Param[] {
  const found = new Map<string, Param>();
  const state: { triple: string | null } = { triple: null };
  let depth = 0;
  let offset = 0;
  for (const line of source.split("\n")) {
    const inString = state.triple !== null; // the line starts inside a triple-quoted string
    const plain = code(line, state);
    const m = depth === 0 && !inString ? ASSIGN.exec(line) : null;
    // the statement must be the whole code of the line (nothing but a comment after the value)
    if (m && code(m[6], { triple: null }).trim() === "") {
      const p = fromLine(m, offset);
      if (p) found.set(p.name, p);
    }
    offset += line.length + 1;
    depth = nextDepth(depth, plain);
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}

function nextDepth(depth: number, plain: string) {
  for (const c of plain) {
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth = Math.max(0, depth - 1);
  }
  return depth;
}

/** The source with parameter `p` set to `value`. */
export function setParam(source: string, p: Param, value: number | boolean): string {
  const text =
    typeof value === "boolean"
      ? value ? "True" : "False"
      : (() => {
          const s = value.toFixed(p.decimals);
          return Object.is(Number(s), -0) ? "0" : s;
        })();
  return source.slice(0, p.start) + text + source.slice(p.end);
}

/** `ring_size_mm` -> `Ring size mm`. */
export const humanize = (name: string) => {
  const s = name.replace(/_+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const UNITS = new Set(["mm", "cm", "deg", "g", "ct", "pct"]);
const UNIT_LABEL: Record<string, string> = { deg: "°", pct: "%" };

/** `ring_size_mm` -> `{ base: "ring_size", unit: "mm" }`; a name without a known unit suffix keeps an empty unit. */
export const splitUnit = (name: string) => {
  const m = /^(.+?)_([a-z]+)$/.exec(name);
  return m && UNITS.has(m[2]) ? { base: m[1], unit: UNIT_LABEL[m[2]] ?? m[2] } : { base: name, unit: "" };
};
