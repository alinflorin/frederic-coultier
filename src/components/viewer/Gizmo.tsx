import { useEffect, useState } from "react";
import { Box, UnstyledButton } from "@mantine/core";
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
const AXIS_COLOR = { x: "#e0524d", y: "#52b86a", z: "#4b8fe0" };
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
    <Box pos="absolute" top={6} left={6} style={{ width: SIZE, height: SIZE, zIndex: 5 }} role="group" aria-label={t("preview.gizmo")}>
      <svg width={SIZE} height={SIZE} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {items.filter((i) => i.positive).map((i) => (
          <line
            key={i.view}
            x1={SIZE / 2}
            y1={SIZE / 2}
            x2={i.x}
            y2={i.y}
            stroke={AXIS_COLOR[i.label.toLowerCase() as "x" | "y" | "z"]}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <UnstyledButton
        onClick={() => viewer?.setView("iso")}
        title={t("preview.view.iso")}
        aria-label={t("preview.view.iso")}
        bg="var(--surface-2)"
        bd="1px solid var(--border)"
        style={{ position: "absolute", left: "50%", top: "50%", width: 10, height: 10, borderRadius: "50%", transform: "translate(-50%, -50%)", zIndex: 0 }}
      />
      {items.map((i) => {
        const size = i.positive ? 20 : 12;
        return (
          <UnstyledButton
            key={i.view}
            onClick={() => viewer?.setView(i.view)}
            title={t(`preview.view.${i.view}`)}
            aria-label={t(`preview.view.${i.view}`)}
            style={{
              position: "absolute",
              left: i.x,
              top: i.y,
              width: size,
              height: size,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "700 10px \"Inter Variable\", Inter, sans-serif",
              color: "#fff",
              background: i.positive ? AXIS_COLOR[i.label.toLowerCase() as "x" | "y" | "z"] : "var(--muted)",
              zIndex: Math.round(i.depth * 10) + 10,
              opacity: i.positive ? (i.depth < -0.2 ? 0.55 : 1) : i.depth < -0.2 ? 0.33 : 0.6,
            }}
          >
            {i.label}
          </UnstyledButton>
        );
      })}
    </Box>
  );
}
