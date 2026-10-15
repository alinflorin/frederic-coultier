import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import type { Viewer, ViewName } from "./Viewer";

const AXES: { view: ViewName; v: THREE.Vector3; label: string; positive: boolean }[] = [
  { view: "right", v: new THREE.Vector3(1, 0, 0), label: "X", positive: true },
  { view: "left", v: new THREE.Vector3(-1, 0, 0), label: "", positive: false },
  { view: "back", v: new THREE.Vector3(0, 1, 0), label: "Y", positive: true },
  { view: "front", v: new THREE.Vector3(0, -1, 0), label: "", positive: false },
  { view: "top", v: new THREE.Vector3(0, 0, 1), label: "Z", positive: true },
  { view: "bottom", v: new THREE.Vector3(0, 0, -1), label: "", positive: false },
];
const SIZE = 92;
const R = 31;

/** Axis orientation widget. Each end is a button that snaps the camera. */
export function Gizmo({ viewer }: { viewer: Viewer | null }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(new THREE.Quaternion());

  useEffect(() => viewer?.onOrient((nq) => setQ(nq.clone())), [viewer]);

  const inv = q.clone().invert();
  const items = AXES.map((a) => {
    const c = a.v.clone().applyQuaternion(inv); // camera space: x right, y up, z towards viewer
    return { ...a, x: SIZE / 2 + c.x * R, y: SIZE / 2 - c.y * R, depth: c.z };
  }).sort((a, b) => a.depth - b.depth);

  return (
    <div className="gizmo" style={{ width: SIZE, height: SIZE }} role="group" aria-label={t("preview.gizmo")}>
      <svg width={SIZE} height={SIZE} aria-hidden="true">
        {items.filter((i) => i.positive).map((i) => (
          <line key={i.view} x1={SIZE / 2} y1={SIZE / 2} x2={i.x} y2={i.y} className={`ax ${i.label.toLowerCase()}`} />
        ))}
      </svg>
      <button className="g-iso" onClick={() => viewer?.setView("iso")} title={t("preview.view.iso")} aria-label={t("preview.view.iso")} />
      {items.map((i) => (
        <button
          key={i.view}
          className={`g-axis ${i.positive ? `pos ${i.label.toLowerCase()}` : "neg"}`}
          style={{ left: i.x, top: i.y, zIndex: Math.round(i.depth * 10) + 10, opacity: i.depth < -0.2 ? 0.55 : 1 }}
          onClick={() => viewer?.setView(i.view)}
          title={t(`preview.view.${i.view}`)}
          aria-label={t(`preview.view.${i.view}`)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
