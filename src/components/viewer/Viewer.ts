import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { acceleratedRaycast } from "three-mesh-bvh";
import type { Health } from "../../api";
import type { ShadingMode } from "../../types";
import { measure, type Measurement, type P3 } from "./measure";
import { BvhBuilder } from "./bvh";
import { type MeshBuf, shadedMesh } from "./geometry";

const AXIS_COLOR = { x: "#e0524d", y: "#52b86a", z: "#4b8fe0" };
/** Full-size layer for the dimension labels and axis ticks drawn over the canvas. */
const LAYER: Partial<CSSStyleDeclaration> = { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" };
const LABEL: Partial<CSSStyleDeclaration> = {
  position: "absolute", left: "0", top: "0", padding: "1px 6px", borderRadius: "4px", font: "600 11px ui-monospace, Menlo, monospace",
  background: "var(--float-bg)", backdropFilter: "blur(8px)", border: "1px solid var(--glass-border)", color: "var(--text)", whiteSpace: "nowrap",
};
const TICK: Partial<CSSStyleDeclaration> = {
  position: "absolute", left: "0", top: "0", font: "600 10px ui-monospace, Menlo, monospace", color: "var(--text)", whiteSpace: "nowrap",
  textShadow: "0 0 3px var(--vp-bg), 0 0 3px var(--vp-bg)",
};

const PIN: Partial<CSSStyleDeclaration> = {
  position: "absolute", left: "0", top: "0", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "9px", boxSizing: "border-box",
  font: "700 11px/18px ui-monospace, Menlo, monospace", textAlign: "center", color: "#fff", border: "2px solid #fff",
  boxShadow: "0 1px 4px rgba(0,0,0,.45)", whiteSpace: "nowrap",
};

/** `a` with the pixels that differ from `b` in red and the rest faded, and the share that differs. */
function diffCanvas(a: HTMLCanvasElement, b: HTMLCanvasElement): { canvas: HTMLCanvasElement; changed: number } {
  const w = a.width;
  const h = a.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  const pa = a.getContext("2d")!.getImageData(0, 0, w, h);
  const pb = b.getContext("2d")!.getImageData(0, 0, w, h);
  const o = ctx.createImageData(w, h);
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    const d = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]) + Math.abs(pa.data[i + 3] - pb.data[i + 3]);
    if (d > 60) {
      n++;
      o.data[i] = 235;
      o.data[i + 1] = 40;
      o.data[i + 2] = 40;
      o.data[i + 3] = 255;
    } else {
      for (let k = 0; k < 3; k++) o.data[i + k] = pa.data[i + k] * 0.4 + 255 * 0.6;
      o.data[i + 3] = 255;
    }
  }
  ctx.putImageData(o, 0, 0);
  return { canvas: out, changed: n / (w * h) };
}

export type ViewName = "front" | "back" | "left" | "right" | "top" | "bottom" | "iso";

export interface ViewerStyle {
  metalColor: string;
  roughness: number;
  display: ShadingMode;
  ortho: boolean;
  grid: boolean;
  dimensions: boolean;
  axes: boolean;
  turntable: boolean;
}

/** Cross-section: keeps the part of the piece at or above `t` (0..1 of its extent) along `axis`. */
export interface Section {
  axis: "x" | "y" | "z";
  t: number;
  flip: boolean;
}

/** A numbered pin on a spot of the piece (model coordinates), for findings. */
export interface Pin {
  at: P3;
  text: string;
  color: string;
}

/** Faces within `angle` degrees of a ceiling, with `up` the build direction in scene coordinates. */
export interface OverhangView {
  up: P3;
  angle: number;
}

/** What is under the pointer. */
export interface Probe {
  kind: "model" | "support";
  /** Scene coordinates (what the viewer shows), and the same in the model's own coordinates. */
  point: P3;
  model: P3;
  normal: P3;
  /** Metal behind the spot, straight in: null for supports or when nothing is behind it. */
  thickness: number | null;
  /** Degrees between the build direction and the surface normal: 0 faces up, 90 is a wall, 180 a ceiling. */
  incline: number;
}

export interface ViewerStats {
  size: [number, number, number];
  tris: number;
  metalVolumeMm3: number;
}

// Z is up. "front" looks from -Y towards +Y, like CAD front views.
const VIEW_DIR: Record<ViewName, THREE.Vector3> = {
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, -0.0001, 1),
  bottom: new THREE.Vector3(0, -0.0001, -1),
  iso: new THREE.Vector3(1, -1.15, 0.85),
};

/** Everything is optional: what is left out stays as it currently is on screen. */
export interface CaptureOptions {
  view?: ViewName;
  /** Degrees around the piece: 0 = front, 90 = right. */
  azimuth?: number;
  /** Degrees above the horizon: 90 = straight down. */
  elevation?: number;
  /** 1 = the whole piece fills the picture. */
  zoom?: number;
  target?: [number, number, number];
  orthographic?: boolean;
  shading?: ShadingMode;
  grid?: boolean;
  axes?: boolean;
  dimensions?: boolean;
  /** `null` removes the section for the picture. */
  section?: Section | null;
  metalColor?: string;
  /** "transparent", or any CSS colour. */
  background?: string;
  width?: number;
  height?: number;
  /** Diagnostics are left out of pictures unless asked for here. */
  overhang?: OverhangView;
  health?: Health;
  /** Drawn on a second copy of the picture, which is returned as `annotated`; the picture itself is untouched. */
  pins?: Pin[];
  /** An earlier version of the piece (model coordinates) to render from the same camera, for `before` and `diff`. */
  alt?: MeshBuf;
}

export interface Captured {
  png: string;
  width: number;
  height: number;
  /** The same picture with the pins drawn on it (only when `pins` were given). */
  annotated?: string;
  /** With `alt`: the earlier version from the same camera, and the picture with what differs in red. */
  before?: string;
  diff?: string;
  /** Share of the picture's pixels that differ. */
  changed?: number;
}

/** A text label drawn on top of a captured picture (the on-screen ones are HTML). */
interface Mark {
  x: number;
  y: number;
  text: string;
  color: string;
  px: number;
}

const FOV = 30;
const ORTHO_HALF = 20; // visible half-height (mm) at zoom 1
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

interface Tween {
  t0: number;
  dur: number;
  fromDir: THREE.Vector3;
  toDir: THREE.Vector3;
  fromDist: number;
  toDist: number;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromZoom: number;
  toZoom: number;
}

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private persp = new THREE.PerspectiveCamera(FOV, 1, 0.1, 2000);
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.persp;
  private controls: OrbitControls;
  private metalMat = new THREE.MeshStandardMaterial({ metalness: 1 });
  private sprueMat = new THREE.MeshStandardMaterial({ color: 0xf0a030, metalness: 0.3, roughness: 0.4 });
  private supportMat = new THREE.MeshStandardMaterial({ color: 0xd9534f, metalness: 0.1, roughness: 0.6 });
  private model: THREE.Group | null = null;
  private bvh = new BvhBuilder();
  /** What `setMesh` last built from, to tell when only the supports changed. */
  private shown: { mesh: MeshBuf; sprue: MeshBuf | null; stats: ViewerStats } | null = null;
  private supportMesh: THREE.Mesh | null = null;
  private edges: THREE.LineSegments[] = [];
  private sun = new THREE.DirectionalLight(0xffffff, 1.2);
  private edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  private grid = new THREE.GridHelper(1, 1);
  private shadow: THREE.Mesh;
  private boxHelper: THREE.Box3Helper;
  private labels: HTMLElement[] = [];
  private section: Section | null = null;
  private clip = new THREE.Plane();
  private axesLines: THREE.LineSegments | null = null;
  private axesKey = "";
  private ticks: HTMLElement[] = [];
  private labelLayer: HTMLElement;
  private tickLayer: HTMLElement;
  private box = new THREE.Box3(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
  private center = new THREE.Vector3();
  private radius = 17;
  private tween: Tween | null = null;
  private dirty = true;
  private raf = 0;
  private ro: ResizeObserver;
  private themeObserver: MutationObserver;
  private scheme: MediaQueryList;
  private onRetheme: () => void;
  private style: ViewerStyle | null = null;
  private lastQ = new THREE.Quaternion();
  private orientCbs = new Set<(q: THREE.Quaternion) => void>();
  /** While capturing: the picture size, and where label text lands in it. */
  private capSize: [number, number] | null = null;
  private marks: Mark[] | null = null;

  // diagnostics: they live outside the model, so a picture can leave them out
  /** Lines and points in model coordinates (broken edges). */
  private diag = new THREE.Group();
  /** Measurement drawing, in scene coordinates. */
  private tools = new THREE.Group();
  /** Model → scene: identity for the piece as modelled, tilt and lift for the piece as printed. */
  private frame = new THREE.Matrix4();
  private frameInv = new THREE.Matrix4();
  private overUniforms = {
    uOverOn: { value: 0 },
    uOverUp: { value: new THREE.Vector3(0, 0, 1) },
    uOverCos: { value: Math.cos(THREE.MathUtils.degToRad(45)) },
  };
  private overhang: OverhangView | null = null;
  private up = new THREE.Vector3(0, 0, 1);
  private lineMats: LineMaterial[] = [];
  private pinLayer: HTMLElement;
  private pins: { data: Pin; el: HTMLElement }[] = [];
  private measureLabels: { el: HTMLElement; at: THREE.Vector3 }[] = [];
  private rc = new THREE.Raycaster();

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none" });
    host.prepend(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.radius = 5;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.grid);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
    this.shadow.receiveShadow = true;
    this.scene.add(this.shadow);
    this.layoutStage();

    this.boxHelper = new THREE.Box3Helper(this.box, new THREE.Color("#d4a24c"));
    this.scene.add(this.boxHelper);

    this.diag.matrixAutoUpdate = false;
    this.diag.renderOrder = 10;
    this.tools.renderOrder = 11;
    this.scene.add(this.diag, this.tools);
    (this.rc as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    this.metalMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.overUniforms);
      // tints the faces that overhang, from the face's own normal (not the smoothed one)
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uOverOn;\nuniform vec3 uOverUp;\nuniform float uOverCos;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          if (uOverOn > 0.5) {
            vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
            if (!gl_FrontFacing) fn = -fn;
            float d = dot(normalize((vec4(fn, 0.0) * viewMatrix).xyz), uOverUp);
            if (d < -uOverCos) diffuseColor.rgb = mix(vec3(1.0, 0.75, 0.1), vec3(0.95, 0.12, 0.1), smoothstep(-uOverCos, -1.0, d));
          }`,
        );
    };

    const overlay = document.createElement("div");
    Object.assign(overlay.style, LAYER);
    for (const axis of ["x", "y", "z"] as const) {
      const l = document.createElement("span");
      Object.assign(l.style, LABEL, { borderColor: AXIS_COLOR[axis] });
      overlay.appendChild(l);
      this.labels.push(l);
    }
    host.appendChild(overlay);
    this.labelLayer = overlay;
    this.tickLayer = document.createElement("div");
    Object.assign(this.tickLayer.style, LAYER);
    host.appendChild(this.tickLayer);
    this.pinLayer = document.createElement("div");
    Object.assign(this.pinLayer.style, LAYER);
    host.appendChild(this.pinLayer);

    this.persp.up.set(0, 0, 1);
    this.ortho.up.set(0, 0, 1);
    this.persp.position.copy(this.center).add(new THREE.Vector3(30, -30, 30));
    this.persp.lookAt(this.center);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.center);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 2.2;
    this.controls.addEventListener("change", () => (this.dirty = true));
    this.renderer.domElement.addEventListener("dblclick", () => this.fit());

    const retheme = () => {
      this.applyTheme();
      this.dirty = true;
    };
    this.themeObserver = new MutationObserver(retheme);
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mantine-color-scheme"] });
    this.scheme = window.matchMedia("(prefers-color-scheme: dark)");
    this.scheme.addEventListener("change", retheme);
    this.onRetheme = retheme;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.setView("iso", false);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---- public API ----

  onOrient(cb: (q: THREE.Quaternion) => void) {
    this.orientCbs.add(cb);
    cb(this.camera.quaternion);
    return () => void this.orientCbs.delete(cb);
  }

  setStyle(s: ViewerStyle) {
    const prev = this.style;
    this.style = s;
    this.metalMat.color.set(s.metalColor);
    this.metalMat.roughness = s.roughness;

    const wire = s.display === "wireframe";
    const xray = s.display === "xray";
    const m = this.metalMat;
    m.wireframe = wire;
    m.transparent = xray;
    m.opacity = xray ? 0.3 : 1;
    m.depthWrite = !xray;
    m.needsUpdate = true;
    for (const e of this.edges) e.visible = s.display === "edges" || xray;
    this.shadow.visible = !wire;
    this.grid.visible = s.grid;
    this.boxHelper.visible = s.dimensions && !!this.model;
    for (const l of this.labels) l.style.display = s.dimensions && this.model ? "" : "none";
    this.controls.autoRotate = s.turntable;
    if (!s.axes || !this.model) this.hideAxes();
    this.applyTheme();
    if (prev?.ortho !== s.ortho) this.setOrtho(s.ortho);
    this.dirty = true;
  }

  /** Cuts the piece open along a plane (null = whole piece). Inner faces stay visible, without a cap. */
  setSection(s: Section | null) {
    this.section = s;
    this.applySection();
  }

  private applySection() {
    const s = this.section;
    const mats = [this.metalMat, this.sprueMat, this.supportMat, this.edgeMat];
    for (const m of mats) {
      m.clippingPlanes = s ? [this.clip] : null;
      if ("clipShadows" in m) m.clipShadows = true;
      if ("side" in m) m.side = s ? THREE.DoubleSide : THREE.FrontSide;
      m.needsUpdate = true;
    }
    if (s) {
      const i = { x: 0, y: 1, z: 2 }[s.axis];
      const v = this.box.min.getComponent(i) + s.t * (this.box.max.getComponent(i) - this.box.min.getComponent(i));
      const n = new THREE.Vector3().setComponent(i, s.flip ? -1 : 1);
      this.clip.set(n, s.flip ? v : -v);
    }
    this.dirty = true;
  }

  /**
   * Shows a shaded mesh (see `shadedMesh`). Returns its stats, or null when there is nothing to show.
   */
  setMesh(
    mesh: MeshBuf | null,
    supports: MeshBuf | null = null,
    sprue: MeshBuf | null = null,
  ): ViewerStats | null {
    if (this.model && this.shown && mesh === this.shown.mesh && sprue === this.shown.sprue) {
      this.setSupports(supports);
      return this.shown.stats;
    }
    const first = !this.model;
    this.shown = null;
    this.supportMesh = null;
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.model = null;
      this.edges = [];
    }
    this.dirty = true;
    const body3 = mesh ? shadedMesh(mesh) : null;
    if (!body3) {
      if (this.style) this.setStyle(this.style);
      return null;
    }

    const body = new THREE.Mesh(body3.geometry, this.metalMat);
    body.castShadow = true;
    this.accelerate(body);
    if (body3.edges) {
      const edges = new THREE.LineSegments(body3.edges, this.edgeMat);
      body.add(edges);
      this.edges = [edges];
    }
    this.model = new THREE.Group().add(body);
    const sprue3 = sprue && shadedMesh(sprue);
    if (sprue3) {
      const m = new THREE.Mesh(sprue3.geometry, this.sprueMat);
      m.castShadow = true;
      this.accelerate(m);
      this.model.add(m);
    }
    this.setSupports(supports);
    this.scene.add(this.model);

    this.box.setFromObject(this.model);
    this.box.getCenter(this.center);
    this.radius = Math.max(this.box.getBoundingSphere(new THREE.Sphere()).radius, 0.5);
    this.controls.minDistance = this.radius * 0.4;
    this.controls.maxDistance = this.radius * 40;
    this.layoutStage();
    this.applySection();
    if (this.style) this.setStyle(this.style);
    if (first) this.fit(false);

    const size = this.box.getSize(new THREE.Vector3());
    const stats = {
      size: [size.x, size.y, size.z] as [number, number, number],
      tris: body3.triangles,
      metalVolumeMm3: body3.volume,
    };
    this.shown = { mesh: mesh as MeshBuf, sprue, stats };
    return stats;
  }

  /** Swaps the supports alone, leaving the model (and its BVH) as built. */
  private setSupports(buf: MeshBuf | null) {
    if (!this.model) return;
    if (this.supportMesh) {
      this.model.remove(this.supportMesh);
      this.supportMesh.geometry.dispose();
      this.supportMesh = null;
    }
    const shaded = buf && shadedMesh(buf);
    if (shaded) {
      const m = new THREE.Mesh(shaded.geometry, this.supportMat);
      m.castShadow = true;
      this.accelerate(m);
      this.model.add(m);
      this.supportMesh = m;
    }
    this.dirty = true;
  }

  /**
   * Raycasts walk a BVH built in a worker: until it arrives (a moment after the mesh appears) a pick
   * falls back to testing every triangle.
   */
  private accelerate(mesh: THREE.Mesh) {
    mesh.raycast = acceleratedRaycast;
    const geometry = mesh.geometry as THREE.BufferGeometry & { boundsTree?: unknown };
    void this.bvh.build(geometry).then((tree) => {
      if (tree && mesh.parent === this.model) geometry.boundsTree = tree;
    });
  }

  /** The first thing under a screen position. */
  private cast(clientX: number, clientY: number) {
    if (!this.model) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.rc.setFromCamera(ndc, this.camera);
    return this.rc.intersectObjects(this.model.children, false)[0] ?? null;
  }

  /** What is under a screen position: the model or a support, and the point in scene (print) coordinates. */
  pick(clientX: number, clientY: number): { kind: "model" | "support"; point: [number, number, number] } | null {
    const hit = this.cast(clientX, clientY);
    if (!hit) return null;
    const kind = (hit.object as THREE.Mesh).material === this.supportMat ? "support" : "model";
    return { kind, point: [hit.point.x, hit.point.y, hit.point.z] };
  }

  /** Everything the pointer is over: where, which way the surface faces, and how much metal is behind it. */
  probe(clientX: number, clientY: number): Probe | null {
    const hit = this.cast(clientX, clientY);
    if (!hit?.face) return null;
    const mesh = hit.object as THREE.Mesh;
    const kind = mesh.material === this.supportMat ? "support" : "model";
    const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
    // facing away from the camera (a cut piece shows its inside): report the side that is seen
    if (n.dot(this.rc.ray.direction) > 0) n.negate();
    const point = hit.point.clone();
    let thickness: number | null = null;
    if (kind === "model") {
      // straight in, to the first surface that faces away: where the ray leaves the metal
      const mat = mesh.material as THREE.Material;
      const side = mat.side;
      mat.side = THREE.BackSide;
      const inward = new THREE.Raycaster(point.clone().addScaledVector(n, -1e-3), n.clone().negate(), 0, 200);
      (inward as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
      const out = inward.intersectObject(mesh, false)[0];
      mat.side = side;
      thickness = out ? out.distance + 1e-3 : null;
    }
    const model = point.clone().applyMatrix4(this.frameInv);
    return {
      kind,
      point: [point.x, point.y, point.z],
      model: [model.x, model.y, model.z],
      normal: [n.x, n.y, n.z],
      thickness,
      incline: THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(n.dot(this.up), -1, 1))),
    };
  }

  /** Model → scene: the tilt (degrees about X) and lift of the piece as printed; 0, 0 for the piece as modelled. */
  setFrame(tiltDeg: number, lift: number) {
    this.frame.makeRotationX(THREE.MathUtils.degToRad(tiltDeg)).setPosition(0, 0, lift);
    this.frameInv.copy(this.frame).invert();
    this.diag.matrix.copy(this.frame);
    this.diag.matrixWorldNeedsUpdate = true;
    this.dirty = true;
  }

  /** The direction the piece is built upwards, in scene coordinates (for the slope of what is probed). */
  setBuildUp(up: P3) {
    this.up.set(...up).normalize();
  }

  /** Tints the faces that overhang (null = off). */
  setOverhang(o: OverhangView | null) {
    this.overhang = o;
    this.applyOverhang(o);
    this.dirty = true;
  }

  private applyOverhang(o: OverhangView | null) {
    this.overUniforms.uOverOn.value = o ? 1 : 0;
    if (o) {
      this.overUniforms.uOverUp.value.set(...o.up).normalize();
      this.overUniforms.uOverCos.value = Math.cos(THREE.MathUtils.degToRad(o.angle));
    }
  }

  /** Draws where the mesh is broken (null = off): open borders, shared or flipped edges, empty triangles. */
  setHealth(h: Health | null) {
    this.clearDiag();
    if (h) this.addHealth(this.diag, h);
    this.dirty = true;
  }

  private clearDiag() {
    for (const o of [...this.diag.children]) {
      this.diag.remove(o);
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat instanceof LineMaterial) this.lineMats = this.lineMats.filter((x) => x !== mat);
      mat?.dispose();
    }
  }

  private addHealth(into: THREE.Object3D, h: Health) {
    const kinds: [[P3, P3][], string][] = [
      [h.open, "#ff3b30"],
      [h.nonManifold, "#d946ef"],
      [h.winding, "#ff9500"],
    ];
    const [w, hh] = this.viewSize();
    for (const [segs, color] of kinds) {
      if (!segs.length) continue;
      const g = new LineSegmentsGeometry().setPositions(segs.flatMap(([a, b]) => [...a, ...b]));
      const mat = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: 3, depthTest: false, transparent: true });
      mat.resolution.set(w, hh);
      this.lineMats.push(mat);
      const l = new LineSegments2(g, mat);
      l.renderOrder = 10;
      into.add(l);
    }
    if (h.degenerate.length) {
      const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(h.degenerate.flat(), 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffd60a", size: 9, sizeAttenuation: false, depthTest: false }));
      pts.renderOrder = 10;
      into.add(pts);
    }
  }

  /** Numbered pins on spots of the piece (null = none). They are HTML over the picture, never part of it. */
  setPins(pins: Pin[] | null) {
    for (const p of this.pins) p.el.remove();
    this.pins = (pins ?? []).map((data) => {
      const el = document.createElement("span");
      el.textContent = data.text;
      Object.assign(el.style, PIN, { background: data.color });
      this.pinLayer.appendChild(el);
      return { data, el };
    });
    this.dirty = true;
  }

  /** Flies the camera to look at a point of the piece (model coordinates), keeping the direction. */
  focus(model: P3) {
    const target = new THREE.Vector3(...model).applyMatrix4(this.frame);
    this.goTo(this.currentDir(), target, true, this.fitDistance() * 0.5);
  }

  /** Draws the points picked with the measure tool (scene coordinates) and returns what they say. */
  setMeasure(points: P3[]): Measurement | null {
    for (const o of [...this.tools.children]) {
      this.tools.remove(o);
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat instanceof LineMaterial) this.lineMats = this.lineMats.filter((x) => x !== mat);
      mat?.dispose();
    }
    for (const l of this.measureLabels) l.el.remove();
    this.measureLabels = [];
    this.dirty = true;
    if (!points.length) return null;
    const color = "#00b3ff";
    const r = Math.max(this.radius * 0.012, 0.05);
    for (const p of points) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      dot.position.set(...p);
      dot.renderOrder = 11;
      this.tools.add(dot);
    }
    const m = measure(points);
    if (!m) return null;
    const [w, h] = this.viewSize();
    const line = (pts: P3[]) => {
      const g = new LineSegmentsGeometry().setPositions(pts.slice(1).flatMap((q, i) => [...pts[i], ...q]));
      const mat = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: 2.5, depthTest: false, transparent: true });
      mat.resolution.set(w, h);
      this.lineMats.push(mat);
      const l = new LineSegments2(g, mat);
      l.renderOrder = 11;
      this.tools.add(l);
    };
    line(points);
    const label = (text: string, at: THREE.Vector3) => {
      const el = document.createElement("span");
      el.textContent = text;
      Object.assign(el.style, LABEL, { borderColor: color });
      this.pinLayer.appendChild(el);
      this.measureLabels.push({ el, at });
    };
    for (let i = 1; i < points.length; i++) {
      const a = new THREE.Vector3(...points[i - 1]);
      const b = new THREE.Vector3(...points[i]);
      label(`${a.distanceTo(b).toFixed(2)} mm`, a.add(b).multiplyScalar(0.5));
    }
    if (m.circle) {
      const { centre, radius, normal } = m.circle;
      // the circle only helps when it is about the size of the piece, not a near-straight line's huge one
      if (radius < this.radius * 6) {
        const c = new THREE.Vector3(...centre);
        const nrm = new THREE.Vector3(...normal);
        const u = new THREE.Vector3(...points[0]).sub(c).normalize();
        const v = nrm.clone().cross(u);
        const ring: P3[] = [];
        for (let i = 0; i <= 64; i++) {
          const t = (i / 64) * Math.PI * 2;
          const q = c.clone().addScaledVector(u, Math.cos(t) * radius).addScaledVector(v, Math.sin(t) * radius);
          ring.push([q.x, q.y, q.z]);
        }
        line(ring);
      }
    }
    return m;
  }

  /** Floor grid, shadow catcher and light follow the model's bounds. */
  private layoutStage() {
    const span = Math.max(80, Math.ceil((this.radius * 6) / 10) * 10);
    const floor = this.box.min.z - 0.02;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    this.grid = new THREE.GridHelper(span, span / 5, 0x888888, 0x888888);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.set(this.center.x, this.center.y, floor);
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.35;
    this.scene.add(this.grid);
    this.applyTheme();

    this.shadow.scale.set(span, span, 1);
    this.shadow.position.set(this.center.x, this.center.y, floor);

    const k = Math.max(1, this.radius / 20);
    this.sun.position.copy(this.center).add(new THREE.Vector3(18, -22, 40).multiplyScalar(k));
    this.sun.target.position.copy(this.center);
    const ext = this.radius * 1.8;
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -ext;
    cam.right = cam.top = ext;
    cam.far = 200 * k;
    cam.updateProjectionMatrix();
    this.applyTheme();
  }

  setView(name: ViewName, animate = true) {
    this.goTo(VIEW_DIR[name].clone().normalize(), this.center, animate);
  }

  fit(animate = true) {
    this.goTo(this.currentDir(), this.center, animate);
  }

  /**
   * A PNG (base64) of the scene with the given overrides, at any size. It changes the viewer for
   * the length of this synchronous call and puts everything back before the browser paints, so
   * the user sees no flicker.
   */
  capture(o: CaptureOptions): Captured {
    if (!this.model) throw new Error("There is nothing to show: the model is empty.");
    if (this.tween) {
      this.applyTween(this.tween, 1);
      this.tween = null;
    }
    const style = this.style;
    const section = this.section;
    const wasOrtho = this.camera === this.ortho;
    const saved = {
      persp: { p: this.persp.position.clone(), q: this.persp.quaternion.clone() },
      ortho: { p: this.ortho.position.clone(), q: this.ortho.quaternion.clone(), zoom: this.ortho.zoom },
      target: this.controls.target.clone(),
      bg: this.renderer.getClearColor(new THREE.Color()).clone(),
      alpha: this.renderer.getClearAlpha(),
      ratio: this.renderer.getPixelRatio(),
    };
    // what the user has switched on for analysis stays out of the picture, unless the caller asks for it
    const diagWas = this.diag.visible;
    const toolsWas = this.tools.visible;
    this.diag.visible = false;
    this.tools.visible = false;
    this.applyOverhang(o.overhang ?? null);
    let extra: THREE.Group | null = null;
    const w = Math.round(THREE.MathUtils.clamp(o.width ?? this.host.clientWidth, 16, 2048));
    const h = Math.round(THREE.MathUtils.clamp(o.height ?? this.host.clientHeight, 16, 2048));
    try {
      if (style) {
        this.setStyle({
          ...style,
          turntable: false,
          metalColor: o.metalColor ?? style.metalColor,
          display: o.shading ?? style.display,
          ortho: o.orthographic ?? style.ortho,
          grid: o.grid ?? style.grid,
          axes: o.axes ?? style.axes,
          dimensions: o.dimensions ?? style.dimensions,
        });
      }
      if (o.section !== undefined) this.setSection(o.section);

      // size first: the fit distance depends on the aspect ratio
      this.capSize = [w, h];
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(w, h, false);
      this.setViewport(w, h);
      if (o.health) {
        extra = new THREE.Group();
        extra.matrixAutoUpdate = false;
        extra.matrix.copy(this.frame);
        this.addHealth(extra, o.health);
        this.scene.add(extra);
      }

      if (o.view || o.azimuth !== undefined || o.elevation !== undefined || o.zoom !== undefined || o.target) {
        const cur = this.currentDir();
        let az = Math.atan2(cur.x, -cur.y);
        let el = Math.asin(THREE.MathUtils.clamp(cur.z, -1, 1));
        if (o.view) {
          const d = VIEW_DIR[o.view].clone().normalize();
          az = Math.atan2(d.x, -d.y);
          el = Math.asin(d.z);
        }
        if (o.azimuth !== undefined) az = THREE.MathUtils.degToRad(o.azimuth);
        if (o.elevation !== undefined) el = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(o.elevation, -89.9, 89.9));
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el));
        const zoom = o.zoom ?? this.fitDistance() / this.distance();
        const dist = this.fitDistance() / Math.max(zoom, 0.01);
        const target = o.target ? new THREE.Vector3(...o.target) : this.controls.target.clone();
        this.controls.target.copy(target);
        this.camera.position.copy(target).addScaledVector(dir, dist);
        this.ortho.zoom = ORTHO_HALF / (dist * TAN_HALF);
        this.ortho.updateProjectionMatrix();
        this.camera.lookAt(target);
      }
      this.camera.updateMatrixWorld();

      const bg = (o.background ?? "transparent").toLowerCase();
      if (bg === "transparent") this.renderer.setClearColor(0x000000, 0);
      else this.renderer.setClearColor(new THREE.Color(bg), 1);

      this.marks = [];
      this.updateAxes();
      this.renderer.render(this.scene, this.camera);
      this.updateLabels();

      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const halo = bg === "transparent" || bg === "white" ? "#ffffffcc" : "#000000aa";
      for (const m of this.marks) {
        ctx.font = `${m.px}px sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = halo;
        ctx.strokeText(m.text, m.x, m.y);
        ctx.fillStyle = m.color;
        ctx.fillText(m.text, m.x, m.y);
      }
      const png = out.toDataURL("image/png").split(",")[1];
      let before: string | undefined;
      let diff: string | undefined;
      let changed: number | undefined;
      const altModel = o.alt ? this.buildAlt(o.alt) : null;
      if (altModel && this.model) {
        // the earlier version in place of the current one, same camera and light
        altModel.matrixAutoUpdate = false;
        altModel.matrix.copy(this.frame);
        const prev = document.createElement("canvas");
        prev.width = w;
        prev.height = h;
        this.model.visible = false;
        this.scene.add(altModel);
        try {
          this.renderer.render(this.scene, this.camera);
          prev.getContext("2d")!.drawImage(this.renderer.domElement, 0, 0, w, h);
        } finally {
          this.scene.remove(altModel);
          altModel.traverse((x) => (x as THREE.Mesh).geometry?.dispose());
          this.model.visible = true;
        }
        before = prev.toDataURL("image/png").split(",")[1];
        const d = diffCanvas(out, prev);
        diff = d.canvas.toDataURL("image/png").split(",")[1];
        changed = d.changed;
      }
      let annotated: string | undefined;
      if (o.pins?.length) {
        // a copy: the picture above is already encoded and stays exactly as rendered
        const copy = document.createElement("canvas");
        copy.width = w;
        copy.height = h;
        const c2 = copy.getContext("2d")!;
        c2.drawImage(out, 0, 0);
        this.drawPins(c2, o.pins, w, h);
        annotated = copy.toDataURL("image/png").split(",")[1];
      }
      return { png, width: w, height: h, annotated, before, diff, changed };
    } finally {
      if (extra) {
        this.scene.remove(extra);
        extra.traverse((x) => {
          const m = x as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | undefined;
          if (mat instanceof LineMaterial) this.lineMats = this.lineMats.filter((l) => l !== mat);
          mat?.dispose();
        });
      }
      this.diag.visible = diagWas;
      this.tools.visible = toolsWas;
      this.applyOverhang(this.overhang);
      this.marks = null;
      this.capSize = null;
      if (style) this.setStyle(style);
      this.setSection(section);
      this.persp.position.copy(saved.persp.p);
      this.persp.quaternion.copy(saved.persp.q);
      this.ortho.position.copy(saved.ortho.p);
      this.ortho.quaternion.copy(saved.ortho.q);
      this.ortho.zoom = saved.ortho.zoom;
      this.controls.target.copy(saved.target);
      if ((this.camera === this.ortho) !== wasOrtho) this.setOrtho(wasOrtho);
      this.renderer.setPixelRatio(saved.ratio);
      this.renderer.setClearColor(saved.bg, saved.alpha);
      this.resize(); // canvas size and projections back to the host's
      this.camera.updateMatrixWorld();
      this.dirty = true;
    }
  }

  /** A throwaway copy of the piece from `mesh`, in the current look (no BVH, no supports). */
  private buildAlt(mesh: MeshBuf): THREE.Group | null {
    const built = shadedMesh(mesh);
    if (!built) return null;
    const body = new THREE.Mesh(built.geometry, this.metalMat);
    body.castShadow = true;
    if (built.edges) {
      const e = new THREE.LineSegments(built.edges, this.edgeMat);
      e.visible = this.style?.display === "edges" || this.style?.display === "xray";
      body.add(e);
    }
    return new THREE.Group().add(body);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.themeObserver.disconnect();
    this.scheme.removeEventListener("change", this.onRetheme);
    this.controls.dispose();
    this.bvh.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.metalMat.dispose();
    this.supportMat.dispose();
    this.sprueMat.dispose();
    this.edgeMat.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.labelLayer.remove();
    this.tickLayer.remove();
    this.pinLayer.remove();
    this.axesLines?.geometry.dispose();
    this.renderer.domElement.remove();
  }

  // ---- internals ----

  private applyTheme() {
    const css = getComputedStyle(this.host);
    this.edgeMat.color.set(css.getPropertyValue("--text").trim() || "#888888");
    const grid = this.grid.material as THREE.LineBasicMaterial;
    grid.color.set(css.getPropertyValue("--grid").trim() || css.getPropertyValue("--muted").trim() || "#888888");
    grid.opacity = parseFloat(css.getPropertyValue("--grid-opacity")) || 0.35;
  }

  private currentDir() {
    return this.camera.position.clone().sub(this.controls.target).normalize();
  }

  private distance() {
    return this.camera === this.persp
      ? this.camera.position.distanceTo(this.controls.target)
      : ORTHO_HALF / (this.ortho.zoom * TAN_HALF);
  }

  private fitDistance() {
    const aspect = this.persp.aspect;
    const half = Math.atan(TAN_HALF * Math.min(1, aspect)); // limiting half-angle
    return (this.radius * 1.2) / Math.sin(half);
  }

  private goTo(dir: THREE.Vector3, target: THREE.Vector3, animate: boolean, distance?: number) {
    const dist = distance ?? this.fitDistance();
    const zoom = ORTHO_HALF / (dist * TAN_HALF);
    const tw: Tween = {
      t0: performance.now(),
      dur: animate ? 420 : 0,
      fromDir: this.currentDir(),
      toDir: dir,
      fromDist: this.distance(),
      toDist: dist,
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromZoom: this.ortho.zoom,
      toZoom: zoom,
    };
    if (animate) this.tween = tw;
    else this.applyTween(tw, 1);
    this.dirty = true;
  }

  private applyTween(tw: Tween, t: number) {
    const e = 1 - Math.pow(1 - t, 3);
    const dir = tw.fromDir.clone().applyQuaternion(
      new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(tw.fromDir, tw.toDir), e),
    );
    const dist = THREE.MathUtils.lerp(tw.fromDist, tw.toDist, e);
    this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.ortho.zoom = THREE.MathUtils.lerp(tw.fromZoom, tw.toZoom, e);
    this.ortho.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
  }

  private setOrtho(on: boolean) {
    const next = on ? this.ortho : this.persp;
    if (next === this.camera) return;
    const dir = this.currentDir();
    const dist = this.distance();
    const target = this.controls.target.clone();
    if (on) this.ortho.zoom = ORTHO_HALF / (dist * TAN_HALF);
    this.camera = next;
    next.position.copy(target).addScaledVector(dir, dist);
    next.lookAt(target);
    this.controls.object = next;
    this.controls.update();
    this.resize();
  }

  private viewSize(): [number, number] {
    return this.capSize ?? [this.host.clientWidth, this.host.clientHeight];
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h);
    this.setViewport(w, h);
    this.dirty = true;
  }

  /** Aspect ratio and frustum for a `w` × `h` picture, without touching the canvas. */
  private setViewport(w: number, h: number) {
    for (const m of this.lineMats) m.resolution.set(w, h);
    const a = w / h;
    this.persp.aspect = a;
    this.persp.updateProjectionMatrix();
    this.ortho.left = -ORTHO_HALF * a;
    this.ortho.right = ORTHO_HALF * a;
    this.ortho.top = ORTHO_HALF;
    this.ortho.bottom = -ORTHO_HALF;
    this.ortho.updateProjectionMatrix();
  }

  private hideAxes() {
    if (this.axesLines) this.axesLines.visible = false;
    for (const t of this.ticks) t.style.display = "none";
  }

  /**
   * Axes through the origin like a CAD view: X and Y run along the floor, Z stands up from it,
   * all long enough to cross the stage. Ticks are numbered every 1-2-5 step that follows the
   * zoom, only around what is on screen, and the numbers shrink with distance (perspective).
   * X/Y read in scene coordinates; Z reads as height above the floor.
   */
  private updateAxes() {
    if (!this.style?.axes || !this.model) return this.hideAxes();
    const floor = this.box.min.z;
    const half = Math.max(80, Math.ceil((this.radius * 6) / 10) * 10) / 2;
    const c = this.center;
    const xlo = Math.min(c.x - half, 0), xhi = Math.max(c.x + half, 0);
    const ylo = Math.min(c.y - half, 0), yhi = Math.max(c.y + half, 0);
    const zhi = Math.max(this.box.max.z, floor) + half;

    const raw = this.distance() / 14;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const step = pow * (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10);
    const tg = this.controls.target;
    const win = step * 14;
    const range = (lo: number, hi: number, near: number) => {
      const out: number[] = [];
      const a = Math.max(lo, near - win), b = Math.min(hi, near + win);
      for (let v = Math.ceil(a / step) * step; v <= b + 1e-9 && out.length < 40; v += step) out.push(+v.toFixed(6));
      return out;
    };
    const xs = range(xlo, xhi, tg.x);
    const ys = range(ylo, yhi, tg.y);
    const zs = range(0, zhi - floor, tg.z - floor);

    const key = [step, floor, xs[0], xs.length, ys[0], ys.length, zs[0], zs.length, xlo, xhi, ylo, yhi, zhi].join("|");
    if (key !== this.axesKey) {
      this.axesKey = key;
      const pts: number[] = [];
      const cols: number[] = [];
      const seg = (p: number[], q: number[], col: THREE.Color) => {
        pts.push(...p, ...q);
        cols.push(col.r, col.g, col.b, col.r, col.g, col.b);
      };
      const red = new THREE.Color("#e0524d"), green = new THREE.Color("#52b86a"), blue = new THREE.Color("#4b8fe0");
      const tk = step * 0.1;
      seg([xlo, 0, floor], [xhi, 0, floor], red);
      seg([0, ylo, floor], [0, yhi, floor], green);
      seg([0, 0, floor], [0, 0, zhi], blue);
      for (const v of xs) seg([v, -tk, floor], [v, tk, floor], red);
      for (const v of ys) seg([-tk, v, floor], [tk, v, floor], green);
      for (const v of zs) seg([-tk, 0, floor + v], [tk, 0, floor + v], blue);
      if (!this.axesLines) {
        this.axesLines = new THREE.LineSegments(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }),
        );
        this.axesLines.renderOrder = 10;
        this.scene.add(this.axesLines);
      }
      this.axesLines.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      this.axesLines.geometry = g;
    }
    this.axesLines!.visible = true;

    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    const off = step * 0.3;
    const items: { p: THREE.Vector3; text: string; axis: "x" | "y" | "z" }[] = [];
    for (const v of xs) items.push({ p: new THREE.Vector3(v, -off, floor), text: v.toFixed(decimals), axis: "x" });
    for (const v of ys) items.push({ p: new THREE.Vector3(-off, v, floor), text: v.toFixed(decimals), axis: "y" });
    for (const v of zs) if (v > 0) items.push({ p: new THREE.Vector3(-off, 0, floor + v), text: v.toFixed(decimals), axis: "z" });

    const [w, h] = this.viewSize();
    const dTarget = this.distance();
    while (this.ticks.length < items.length) {
      const l = document.createElement("span");
      Object.assign(l.style, TICK);
      this.tickLayer.appendChild(l);
      this.ticks.push(l);
    }
    this.ticks.forEach((l, i) => {
      const it = items[i];
      if (!it) return void (l.style.display = "none");
      const v = it.p.clone().project(this.camera);
      l.style.display = v.z > 1 ? "none" : "";
      l.style.color = AXIS_COLOR[it.axis];
      l.textContent = it.text;
      const depth = this.camera === this.persp ? this.camera.position.distanceTo(it.p) : dTarget;
      const px = THREE.MathUtils.clamp(13 * (dTarget / depth), 7, 22);
      l.style.fontSize = `${px.toFixed(1)}px`;
      l.style.transform = `translate(-50%, -50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
      if (this.marks && v.z <= 1) {
        const color = AXIS_COLOR[it.axis];
        this.marks.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, text: it.text, color, px });
      }
    });
  }

  /** Is the point (scene coordinates) in view, and not hidden behind the piece? */
  private visibleFromCamera(p: THREE.Vector3): boolean {
    if (!this.model) return false;
    const from = this.camera.position;
    const dir = p.clone().sub(from);
    const d = dir.length();
    this.rc.set(from, dir.normalize());
    this.rc.far = d;
    this.rc.near = 0;
    const hit = this.rc.intersectObjects(this.model.children, false)[0];
    this.rc.far = Infinity;
    return !hit || hit.distance > d - Math.max(0.15, this.radius * 0.02);
  }

  /** Puts the pins and the measurement labels over the spots they belong to. */
  private updatePins() {
    const [w, h] = this.viewSize();
    const place = (el: HTMLElement, at: THREE.Vector3) => {
      const v = at.clone().project(this.camera);
      el.style.transform = `translate(-50%, -50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
      el.style.visibility = v.z > 1 ? "hidden" : "visible";
    };
    for (const p of this.pins) {
      const at = new THREE.Vector3(...p.data.at).applyMatrix4(this.frame);
      place(p.el, at);
      p.el.style.opacity = this.visibleFromCamera(at) ? "1" : "0.35";
    }
    for (const l of this.measureLabels) place(l.el, l.at);
  }

  /** The pins drawn on a copy of the picture: a dot with its number, dimmed when the spot is behind the piece. */
  private drawPins(ctx: CanvasRenderingContext2D, pins: Pin[], w: number, h: number) {
    const taken: [number, number][] = [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const pin of pins) {
      const at = new THREE.Vector3(...pin.at).applyMatrix4(this.frame);
      const v = at.clone().project(this.camera);
      if (v.z > 1) continue;
      let x = (v.x * 0.5 + 0.5) * w;
      let y = (-v.y * 0.5 + 0.5) * h;
      // pins landing on top of each other fan out upwards
      while (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 22)) y -= 22;
      taken.push([x, y]);
      const r = Math.max(10, Math.min(w, h) / 40);
      ctx.save();
      ctx.globalAlpha = this.visibleFromCamera(at) ? 1 : 0.45;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = pin.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(r * 1.1)}px sans-serif`;
      ctx.fillText(pin.text, x, y + 0.5);
      ctx.restore();
    }
  }

  private updateLabels() {
    if (!this.style?.dimensions || !this.model) return;
    const { min, max } = this.box;
    const s = this.box.getSize(new THREE.Vector3());
    const anchors: [THREE.Vector3, number][] = [
      [new THREE.Vector3((min.x + max.x) / 2, min.y, min.z), s.x],
      [new THREE.Vector3(max.x, (min.y + max.y) / 2, min.z), s.y],
      [new THREE.Vector3(min.x, min.y, (min.z + max.z) / 2), s.z],
    ];
    const [w, h] = this.viewSize();
    anchors.forEach(([p, len], i) => {
      const v = p.project(this.camera);
      const l = this.labels[i];
      l.textContent = `${len.toFixed(1)} mm`;
      l.style.transform = `translate(-50%, -50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
      l.style.visibility = v.z > 1 ? "hidden" : "visible";
      if (this.marks && v.z <= 1) {
        const color = getComputedStyle(this.host).getPropertyValue("--text").trim() || "#333333";
        this.marks.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, text: l.textContent ?? "", color, px: 13 });
      }
    });
  }

  private loop() {
    this.raf = requestAnimationFrame(this.loop);
    if (this.tween) {
      const t = this.tween.dur ? Math.min(1, (performance.now() - this.tween.t0) / this.tween.dur) : 1;
      this.applyTween(this.tween, t);
      if (t >= 1) this.tween = null;
      this.dirty = true;
    }
    const moved = this.controls.update();
    if (!this.dirty && !moved && !this.controls.autoRotate) return;
    this.dirty = false;
    this.updateAxes(); // before drawing: it toggles and rebuilds the axis lines
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.updatePins();
    if (!this.lastQ.equals(this.camera.quaternion)) {
      this.lastQ.copy(this.camera.quaternion);
      this.orientCbs.forEach((cb) => cb(this.lastQ));
    }
  }
}
