// The OpenSCAD that goes with an imported STL: the `import()` itself plus the cuts that remove
// sections of it. Every number of a cut is a top-level `name = value;` line with a range comment,
// so it shows up as a slider in the Parameters panel and can be tuned without touching the code.

import type { AssetInfo } from "./api";

export type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

export type Cut =
  /** Removes everything above (larger coordinate) or below `at` along `axis`. */
  | { kind: "half"; axis: Axis; remove: "above" | "below"; at: number }
  /** Removes the box between `min` and `max`. */
  | { kind: "box"; min: [number, number, number]; max: [number, number, number] };

/** A valid OpenSCAD identifier made from a file name. */
export function identOf(file: string): string {
  const stem = file.replace(/\.stl$/i, "").replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(stem) ? stem : `m_${stem}`;
}

const trim = (n: number) => String(Number.parseFloat(n.toFixed(4)));

function range(asset: AssetInfo, k: number): string {
  const [lo, hi] = asset.bounds ?? [[0, 0, 0], [100, 100, 100]];
  const span = Math.max(hi[k] - lo[k], 1);
  const pad = span * 0.1;
  const step = span >= 50 ? 0.5 : span >= 5 ? 0.1 : 0.01;
  const snap = (v: number) => Math.round(v / step) * step;
  return `[${trim(snap(lo[k] - pad))}:${step}:${trim(snap(hi[k] + pad))}]`;
}

/** Defaults for a new cut: the middle of the mesh. */
export function defaultCut(asset: AssetInfo, kind: Cut["kind"]): Cut {
  const [lo, hi] = asset.bounds ?? [[0, 0, 0], [10, 10, 10]];
  const mid = (k: number) => (lo[k] + hi[k]) / 2;
  if (kind === "half") return { kind, axis: "z", remove: "above", at: Number(trim(mid(2))) };
  return {
    kind,
    min: [0, 1, 2].map((k) => Number(trim(lo[k] + (hi[k] - lo[k]) * 0.25))) as [number, number, number],
    max: [0, 1, 2].map((k) => Number(trim(lo[k] + (hi[k] - lo[k]) * 0.75))) as [number, number, number],
  };
}

/** The source to append to a model: variables, then the mesh with its cuts taken out. */
export function importSource(asset: AssetInfo, cuts: Cut[]): string {
  const id = identOf(asset.name);
  const [lo, hi] = asset.bounds ?? [[0, 0, 0], [0, 0, 0]];
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]);
  // cutters only have to be bigger than the mesh, wherever the cut is
  const big = trim(Math.ceil(Math.max(...size, 1) * 10 + Math.max(...lo.map(Math.abs), ...hi.map(Math.abs))));
  const dims = AXES.map((a, k) => `${a} ${trim(lo[k])}..${trim(hi[k])}`).join(", ");

  const vars: string[] = [];
  const cutters: string[] = [];
  cuts.forEach((cut, i) => {
    const n = i + 1;
    if (cut.kind === "half") {
      const k = AXES.indexOf(cut.axis);
      const v = `${id}_cut${n}_${cut.axis}`;
      vars.push(`${v} = ${trim(cut.at)}; // ${cut.remove === "above" ? "remove everything above" : "remove everything below"} this ${cut.axis} ${range(asset, k)}`);
      const pos = [`-${big}`, `-${big}`, `-${big}`];
      const dim = [`${big} * 2`, `${big} * 2`, `${big} * 2`];
      pos[k] = cut.remove === "above" ? v : `${v} - ${big}`;
      dim[k] = big;
      cutters.push(`  // cut ${n}: everything ${cut.remove} ${cut.axis} = ${trim(cut.at)}\n  translate([${pos.join(", ")}]) cube([${dim.join(", ")}]);`);
    } else {
      const names = AXES.map((a) => [`${id}_cut${n}_${a}min`, `${id}_cut${n}_${a}max`] as const);
      AXES.forEach((a, k) => {
        vars.push(`${names[k][0]} = ${trim(cut.min[k])}; // box ${n}: ${a} from ${range(asset, k)}`);
        vars.push(`${names[k][1]} = ${trim(cut.max[k])}; // box ${n}: ${a} to ${range(asset, k)}`);
      });
      const pos = names.map(([a]) => a).join(", ");
      const dim = names.map(([a, b]) => `${b} - ${a}`).join(", ");
      cutters.push(`  // cut ${n}: a box\n  translate([${pos}]) cube([${dim}]);`);
    }
  });

  const head = `// Imported mesh ${asset.name}: ${asset.triangles} triangles, ${dims}`;
  const body = cuts.length
    ? `difference() {\n  import("${asset.name}");\n${cutters.join("\n")}\n}`
    : `import("${asset.name}");`;
  return [head, ...vars, body].join("\n") + "\n";
}

/** `source` with `addition` after it, separated by a blank line. */
export function appendSource(source: string, addition: string): string {
  const base = source.replace(/\s+$/, "");
  return base ? `${base}\n\n${addition}` : addition;
}
