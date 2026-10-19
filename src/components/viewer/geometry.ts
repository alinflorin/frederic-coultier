import * as THREE from "three";
import { Vector3 } from "three";

/** Smallest valid mesh payload: the two u32 counts. */
export const MESH_HEADER = 8;

/**
 * Wraps the backend's indexed mesh (`u32 vertices | u32 triangles | f32 xyz... | u32 abc...`, see
 * `render::encode_indexed`) without copying: the attributes are views over `buf`.
 * Returns null for an empty payload.
 */
export function indexedGeometry(buf: ArrayBuffer): THREE.BufferGeometry | null {
  if (buf.byteLength <= MESH_HEADER) return null;
  const [nv, nt] = new Uint32Array(buf, 0, 2);
  if (!nt) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buf, MESH_HEADER, nv * 3), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, MESH_HEADER + nv * 12, nt * 3), 1));
  return g;
}

/** Same, with flat per-face normals (supports and sprue are drawn faceted). */
export function flatGeometry(buf: ArrayBuffer): THREE.BufferGeometry | null {
  const indexed = indexedGeometry(buf);
  if (!indexed) return null;
  const g = indexed.toNonIndexed();
  indexed.dispose();
  g.computeVertexNormals();
  return g;
}

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
