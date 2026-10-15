import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ShadingMode } from "../../types";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { meshVolume } from "./geometry";

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

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    const overlay = document.createElement("div");
    overlay.className = "vp-labels";
    for (const axis of ["x", "y", "z"]) {
      const l = document.createElement("span");
      l.className = `vp-label ${axis}`;
      overlay.appendChild(l);
      this.labels.push(l);
    }
    host.appendChild(overlay);
    this.tickLayer = document.createElement("div");
    this.tickLayer.className = "vp-labels vp-ticks";
    host.appendChild(this.tickLayer);

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
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
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

  /** Shows an STL (binary or ASCII). Returns its stats, or null when there is nothing to show. */
  setMesh(stl: ArrayBuffer | null, supportsStl: ArrayBuffer | null = null, sprueStl: ArrayBuffer | null = null): ViewerStats | null {
    const first = !this.model;
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.model = null;
      this.edges = [];
    }
    this.dirty = true;
    if (!stl || stl.byteLength < 84) {
      if (this.style) this.setStyle(this.style);
      return null;
    }

    const raw = new STLLoader().parse(stl);
    const geo = toCreasedNormals(raw, THREE.MathUtils.degToRad(35));
    raw.dispose();
    const mesh = new THREE.Mesh(geo, this.metalMat);
    mesh.castShadow = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), this.edgeMat);
    mesh.add(edges);
    this.edges = [edges];
    this.model = new THREE.Group().add(mesh);
    if (supportsStl && supportsStl.byteLength > 84) {
      const sup = new THREE.Mesh(new STLLoader().parse(supportsStl), this.supportMat);
      sup.castShadow = true;
      this.model.add(sup);
    }
    if (sprueStl && sprueStl.byteLength > 84) {
      const sp = new THREE.Mesh(new STLLoader().parse(sprueStl), this.sprueMat);
      sp.castShadow = true;
      this.model.add(sp);
    }
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
    return {
      size: [size.x, size.y, size.z],
      tris: geo.attributes.position.count / 3,
      metalVolumeMm3: meshVolume(geo),
    };
  }

  /** What is under a screen position: the model or a support, and the point in scene (print) coordinates. */
  pick(clientX: number, clientY: number): { kind: "model" | "support"; point: [number, number, number] } | null {
    if (!this.model) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    const hit = rc.intersectObjects(this.model.children, false)[0];
    if (!hit) return null;
    const kind = (hit.object as THREE.Mesh).material === this.supportMat ? "support" : "model";
    return { kind, point: [hit.point.x, hit.point.y, hit.point.z] };
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

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.themeObserver.disconnect();
    this.scheme.removeEventListener("change", this.onRetheme);
    this.controls.dispose();
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
    this.host.querySelectorAll(".vp-labels").forEach((e) => e.remove());
    this.axesLines?.geometry.dispose();
    this.renderer.domElement.remove();
  }

  // ---- internals ----

  private applyTheme() {
    const css = getComputedStyle(this.host);
    this.edgeMat.color.set(css.getPropertyValue("--text").trim() || "#888888");
    const grid = this.grid.material as THREE.LineBasicMaterial;
    grid.color.set(css.getPropertyValue("--muted").trim() || "#888888");
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

  private goTo(dir: THREE.Vector3, target: THREE.Vector3, animate: boolean) {
    const dist = this.fitDistance();
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

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h);
    const a = w / h;
    this.persp.aspect = a;
    this.persp.updateProjectionMatrix();
    this.ortho.left = -ORTHO_HALF * a;
    this.ortho.right = ORTHO_HALF * a;
    this.ortho.top = ORTHO_HALF;
    this.ortho.bottom = -ORTHO_HALF;
    this.ortho.updateProjectionMatrix();
    this.dirty = true;
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

    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const dTarget = this.distance();
    while (this.ticks.length < items.length) {
      const l = document.createElement("span");
      l.className = "vp-tick";
      this.tickLayer.appendChild(l);
      this.ticks.push(l);
    }
    this.ticks.forEach((l, i) => {
      const it = items[i];
      if (!it) return void (l.style.display = "none");
      const v = it.p.clone().project(this.camera);
      l.style.display = v.z > 1 ? "none" : "";
      l.dataset.axis = it.axis;
      l.textContent = it.text;
      const depth = this.camera === this.persp ? this.camera.position.distanceTo(it.p) : dTarget;
      const px = THREE.MathUtils.clamp(13 * (dTarget / depth), 7, 22);
      l.style.fontSize = `${px.toFixed(1)}px`;
      l.style.transform = `translate(-50%, -50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    });
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
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    anchors.forEach(([p, len], i) => {
      const v = p.project(this.camera);
      const l = this.labels[i];
      l.textContent = `${len.toFixed(1)} mm`;
      l.style.transform = `translate(-50%, -50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
      l.style.visibility = v.z > 1 ? "hidden" : "visible";
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
    if (!this.lastQ.equals(this.camera.quaternion)) {
      this.lastQ.copy(this.camera.quaternion);
      this.orientCbs.forEach((cb) => cb(this.lastQ));
    }
  }
}
