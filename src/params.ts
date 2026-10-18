// Parameter sliders: the top-level `name = number;` (or `true`/`false`) lines of the OpenSCAD
// source, with an optional Customizer-style range in the trailing comment:
//
//   band_width = 2.4;   // width of the band [1:0.1:6]
//   prongs     = 4;     // [3:8]
//   pave       = true;

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

const ASSIGN = /^(\s*)([A-Za-z_]\w*)(\s*=\s*)(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|true|false)(\s*;)(.*)$/;
const RANGE = /\[\s*(-?[\d.]+)\s*:\s*(?:(-?[\d.]+)\s*:\s*)?(-?[\d.]+)\s*\]/;

const decimalsOf = (text: string) => {
  const m = /\.(\d+)/.exec(text);
  return m ? m[1].length : 0;
};

/** Strips comments and strings from one line, tracking `/* ... *\/` across lines. */
function code(line: string, state: { block: boolean }): string {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    if (state.block) {
      if (line[i] === "*" && line[i + 1] === "/") (state.block = false), i++;
      continue;
    }
    const c = line[i];
    if (c === "/" && line[i + 1] === "/") break;
    if (c === "/" && line[i + 1] === "*") {
      state.block = true;
      i++;
      continue;
    }
    if (c === '"') {
      i++;
      while (i < line.length && line[i] !== '"') i += line[i] === "\\" ? 2 : 1;
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
  const comment = /\/\/(.*)$/.exec(rest)?.[1] ?? "";
  const range = RANGE.exec(comment);
  const note = comment.replace(RANGE, "").trim();
  if (literal === "true" || literal === "false") {
    return { name, kind: "bool", value: literal === "true", min: 0, max: 1, step: 1, note, start, end, decimals: 0, hinted: true };
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
  const state = { block: false };
  let depth = 0;
  let offset = 0;
  for (const line of source.split("\n")) {
    const plain = code(line, state);
    const m = depth === 0 ? ASSIGN.exec(line) : null;
    // the statement must be the whole code of the line (nothing but a comment after the `;`)
    if (m && code(m[6], { block: false }).trim() === "" && plain.trim().endsWith(";")) {
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
      ? String(value)
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
