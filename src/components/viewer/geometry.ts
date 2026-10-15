import type * as THREE from "three";
import { Vector3 } from "three";

/** Volume in the geometry's units³, from signed tetrahedra. Assumes a closed mesh. */
export function meshVolume(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const idx = g.index;
  const n = idx ? idx.count : p.count;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let v = 0;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
    b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(v);
}
