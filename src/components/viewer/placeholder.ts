import * as THREE from "three";

// Stand-in model until the real OpenSCAD output is wired in: a four-prong
// solitaire. Z is up (like OpenSCAD); the finger axis runs along Y.

export interface Placeholder {
  group: THREE.Group;
  metal: THREE.Mesh[];
  gems: THREE.Mesh[];
  tris: number;
  metalVolumeMm3: number;
}

function arc(cx: number, cy: number, r: number, from: number, to: number, n: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = THREE.MathUtils.degToRad(from + ((to - from) * i) / n);
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return pts;
}

/** Closed rounded-rectangle section, counter-clockwise so lathe normals face out. */
function bandSection(inner: number, thick: number, width: number, r: number) {
  const o = inner + thick;
  const h = width / 2;
  return [
    ...arc(o - r, h - r, r, 0, 90, 6),
    ...arc(inner + r, h - r, r, 90, 180, 6),
    ...arc(inner + r, -h + r, r, 180, 270, 6),
    ...arc(o - r, -h + r, r, 270, 360, 6),
    new THREE.Vector2(o, -h + r),
  ];
}

function volume(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const idx = g.index;
  const n = idx ? idx.count : p.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
    b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(v);
}

const triCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const v2 = (pairs: [number, number][]) => pairs.map(([x, y]) => new THREE.Vector2(x, y));

export function buildPlaceholder(
  metalMat: THREE.Material,
  gemMat: THREE.Material,
): Placeholder {
  const INNER = 8.65; // EU 54
  const THICK = 1.6;
  const top = INNER + THICK; // z of the band's top surface

  const group = new THREE.Group();
  const metal: THREE.Mesh[] = [];
  const gems: THREE.Mesh[] = [];
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Mesh[]) => {
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    group.add(m);
    list.push(m);
  };
  // Lathe turns around Y; rotateX(90°) re-points that axis to Z.
  const upright = (g: THREE.BufferGeometry, z: number) => g.rotateX(Math.PI / 2).translate(0, 0, z);

  add(new THREE.LatheGeometry(bandSection(INNER, THICK, 2.4, 0.45), 160), metalMat, metal);

  const z0 = top - 0.3;
  add(
    upright(new THREE.LatheGeometry(v2([[0, 0], [1.5, 0], [2.7, 2.2], [2.3, 2.2], [0, 1]]), 48), z0),
    metalMat,
    metal,
  );

  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const x = 2.7 * Math.cos(a);
    const y = 2.7 * Math.sin(a);
    const stem = new THREE.CylinderGeometry(0.45, 0.55, 3.1, 20).rotateX(Math.PI / 2).translate(x, y, z0 + 1.55);
    const cap = new THREE.SphereGeometry(0.45, 20, 12).translate(x, y, z0 + 3.1);
    add(stem, metalMat, metal);
    add(cap, metalMat, metal);
  }

  const girdle = z0 + 1 + 1.55;
  add(
    upright(new THREE.LatheGeometry(v2([[0, -1.55], [2.5, 0], [2.55, 0.15], [1.5, 1], [0, 1]]), 16), girdle),
    gemMat,
    gems,
  );

  let tris = 0;
  let vol = 0;
  for (const m of metal) {
    tris += triCount(m.geometry);
    vol += volume(m.geometry);
  }
  for (const m of gems) tris += triCount(m.geometry);

  return { group, metal, gems, tris, metalVolumeMm3: vol };
}
