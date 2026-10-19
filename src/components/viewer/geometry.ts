import * as THREE from "three";

/** Smallest valid mesh payload: the fixed header. */
export const MESH_HEADER = 20;

/** A mesh payload inside a larger reply: `offset` is 4-byte aligned, `length` its byte size. */
export interface MeshBuf {
  buf: ArrayBuffer;
  offset: number;
  length: number;
}

export interface ShadedMesh {
  /** Positions, normals and (when indexed) triangle indices. */
  geometry: THREE.BufferGeometry;
  /** Feature edges as line segments, absent for flat-shaded meshes. */
  edges: THREE.BufferGeometry | null;
  triangles: number;
  /** In the geometry's units³. */
  volume: number;
}

/**
 * Wraps the backend's shaded mesh without copying: the attributes are views over the payload.
 * Everything is precomputed in Rust (see `shade.rs`):
 * `u32 vertices | u32 triangles | u32 indexed | u32 edge vertices | f32 volume |`
 * `f32 xyz positions | f32 xyz normals | u32 abc indices (if indexed) | f32 xyz edge segments`.
 * Returns null for an empty payload.
 */
export function shadedMesh({ buf, offset, length }: MeshBuf): ShadedMesh | null {
  if (length <= MESH_HEADER) return null;
  const [nv, nt, indexed, ne] = new Uint32Array(buf, offset, 4);
  if (!nt) return null;
  const volume = new Float32Array(buf, offset + 16, 1)[0];
  let at = offset + MESH_HEADER;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buf, at, nv * 3), 3));
  at += nv * 12;
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(buf, at, nv * 3), 3));
  at += nv * 12;
  if (indexed) {
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, at, nt * 3), 1));
    at += nt * 12;
  }
  let edges: THREE.BufferGeometry | null = null;
  if (ne) {
    edges = new THREE.BufferGeometry();
    edges.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buf, at, ne * 3), 3));
  }
  return { geometry, edges, triangles: nt, volume };
}
