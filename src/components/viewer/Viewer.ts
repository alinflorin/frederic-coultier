import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ShadingMode } from "../../types";
import { buildPlaceholder } from "./placeholder";

export type ViewName = "front" | "back" | "left" | "right" | "top" | "bottom" | "iso";

export interface ViewerStyle {
  metalColor: string;
  gemColor: string;
  roughness: number;
  display: ShadingMode;
  ortho: boolean;
  grid: boolean;
  dimensions: boolean;
  turntable: boolean;
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
  private gemMat = new THREE.MeshPhysicalMaterial({
    metalness: 0, roughness: 0.04, ior: 2.4, thickness: 3, transmission: 0.65,
    flatShading: true, envMapIntensity: 1.6,
  });
  private edges: THREE.LineSegments[] = [];
  private edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  private grid: THREE.GridHelper;
  private shadow: THREE.Mesh;
  private boxHelper: THREE.Box3Helper;
  private labels: HTMLElement[] = [];
  private box = new THREE.Box3();
  private center = new THREE.Vector3();
  private radius = 1;
  private tween: Tween | null = null;
  private dirty = true;
  private raf = 0;
  private ro: ResizeObserver;
  private style: ViewerStyle | null = null;
  private lastQ = new THREE.Quaternion();
  private orientCbs = new Set<(q: THREE.Quaternion) => void>();
  readonly stats: ViewerStats;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.prepend(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(18, -22, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
    sun.shadow.camera.right = sun.shadow.camera.top = 25;
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 5;
    this.scene.add(sun);

    const model = buildPlaceholder(this.metalMat, this.gemMat);
    for (const m of [...model.metal, ...model.gems]) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), this.edgeMat);
      m.add(e);
      this.edges.push(e);
    }
    this.scene.add(model.group);

    this.box.setFromObject(model.group);
    this.box.getCenter(this.center);
    this.radius = this.box.getBoundingSphere(new THREE.Sphere()).radius;
    const size = this.box.getSize(new THREE.Vector3());
    this.stats = {
      size: [size.x, size.y, size.z],
      tris: Math.round(model.tris),
      metalVolumeMm3: model.metalVolumeMm3,
    };

    const floor = this.box.min.z - 0.02;
    this.grid = new THREE.GridHelper(80, 16, 0x888888, 0x888888);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = floor;
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(this.grid);

    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.28 }));
    this.shadow.position.z = floor;
    this.shadow.receiveShadow = true;
    this.scene.add(this.shadow);

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

    this.persp.up.set(0, 0, 1);
    this.ortho.up.set(0, 0, 1);
    this.persp.position.copy(this.center).add(new THREE.Vector3(30, -30, 30));
    this.persp.lookAt(this.center);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.center);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 400;
    this.controls.autoRotateSpeed = 2.2;
    this.controls.addEventListener("change", () => (this.dirty = true));
    this.renderer.domElement.addEventListener("dblclick", () => this.fit());

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
    this.gemMat.color.set(s.gemColor);
    this.gemMat.attenuationColor.set(s.gemColor);

    const wire = s.display === "wireframe";
    const xray = s.display === "xray";
    for (const m of [this.metalMat, this.gemMat]) {
      m.wireframe = wire;
      m.transparent = xray;
      m.opacity = xray ? 0.3 : 1;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    }
    this.gemMat.transmission = wire || xray ? 0 : 0.65;
    for (const e of this.edges) e.visible = s.display === "edges" || xray;
    this.shadow.visible = !wire;
    this.grid.visible = s.grid;
    this.boxHelper.visible = s.dimensions;
    for (const l of this.labels) l.style.display = s.dimensions ? "" : "none";
    this.controls.autoRotate = s.turntable;
    this.applyTheme();
    if (prev?.ortho !== s.ortho) this.setOrtho(s.ortho);
    this.dirty = true;
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
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.metalMat.dispose();
    this.gemMat.dispose();
    this.edgeMat.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.host.querySelector(".vp-labels")?.remove();
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

  private updateLabels() {
    if (!this.style?.dimensions) return;
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
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    if (!this.lastQ.equals(this.camera.quaternion)) {
      this.lastQ.copy(this.camera.quaternion);
      this.orientCbs.forEach((cb) => cb(this.lastQ));
    }
  }
}
