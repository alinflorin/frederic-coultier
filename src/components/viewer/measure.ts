export type P3 = [number, number, number];

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: P3) => Math.hypot(a[0], a[1], a[2]);

export interface Measurement {
  /** Straight line from the first to the last point, mm. */
  distance: number;
  delta: P3;
  /** Total length of the path through all the points, mm. */
  path: number;
  /** Angle at the second point between the first and the third, degrees (three points). */
  angle?: number;
  /** Circle through the three points (null when they are in a line). */
  circle?: { centre: P3; radius: number; normal: P3 } | null;
}

/** The circle through three points in space, or null when they are (nearly) in a line. */
export function circleThrough(a: P3, b: P3, c: P3): { centre: P3; radius: number; normal: P3 } | null {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const n = cross(ab, ac);
  const n2 = dot(n, n);
  if (n2 < 1e-12 * Math.max(1, dot(ab, ab) * dot(ac, ac))) return null;
  // centre = a + (|ac|² (ab × ac) × ab + |ab|² ac × (ab × ac)) / (2 |ab × ac|²)
  const t1 = cross(n, ab);
  const t2 = cross(ac, n);
  const k1 = dot(ac, ac) / (2 * n2);
  const k2 = dot(ab, ab) / (2 * n2);
  const off: P3 = [t1[0] * k1 + t2[0] * k2, t1[1] * k1 + t2[1] * k2, t1[2] * k1 + t2[2] * k2];
  const l = len(n);
  return {
    centre: [a[0] + off[0], a[1] + off[1], a[2] + off[2]],
    radius: len(off),
    normal: [n[0] / l, n[1] / l, n[2] / l],
  };
}

/** What two or three picked points say: distances, the angle at the middle one, the circle through them. */
export function measure(points: P3[]): Measurement | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  let path = 0;
  for (let i = 1; i < points.length; i++) path += len(sub(points[i], points[i - 1]));
  const m: Measurement = { distance: len(sub(last, first)), delta: sub(last, first), path };
  if (points.length >= 3) {
    const [a, b, c] = points;
    const u = sub(a, b);
    const v = sub(c, b);
    const d = len(u) * len(v);
    if (d > 1e-12) m.angle = (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / d))) * 180) / Math.PI;
    m.circle = circleThrough(a, b, c);
  }
  return m;
}
