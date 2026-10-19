import { useEffect, useRef, useState } from "react";
import { Box, Button, ColorInput, Group, Slider, Text, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Attached } from "../../types";
import { Icon } from "../Icon";
import type { Viewer } from "./Viewer";

interface Stroke {
  color: string;
  width: number;
  /** Fractions of the canvas, so strokes follow the pane when it is resized. */
  pts: [number, number][];
}

const COLORS = ["#ff2d2d", "#ffb800", "#22c55e", "#2d7bff", "#ffffff", "#000000"];

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    if (s.pts.length === 1) {
      ctx.beginPath();
      ctx.arc(s.pts[0][0] * w, s.pts[0][1] * h, s.width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.stroke();
  }
}

const loadImage = (png: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = `data:image/png;base64,${png}`;
  });

/**
 * Freehand drawing over the 3D view, to point the agent at a problem. It covers the viewer while
 * active (so the camera stays where it is), and "Send" attaches the view with the drawing on it.
 */
export function Annotator({
  viewer,
  onSend,
  onClose,
}: {
  viewer: Viewer | null;
  onSend: (picture: Attached) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(5);
  const [count, setCount] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  const redraw = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    paint(ctx, current.current ? [...strokes.current, current.current] : strokes.current, c.width, c.height);
  };

  // keep the bitmap the size of the pane (and sharp on dense screens)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const k = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(c.clientWidth * k));
      c.height = Math.max(1, Math.round(c.clientHeight * k));
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const k = () => (canvas.current ? canvas.current.width / canvas.current.clientWidth : 1);

  const undo = () => {
    strokes.current.pop();
    setCount(strokes.current.length);
    redraw();
  };
  const clear = () => {
    strokes.current = [];
    setCount(0);
    redraw();
  };

  async function send() {
    if (!viewer) return;
    setProblem(null);
    try {
      const dark = (document.documentElement.dataset.theme ?? "") === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      const w = canvas.current!.clientWidth;
      const h = canvas.current!.clientHeight;
      const shot = viewer.capture({ width: w, height: h, background: dark ? "#1e1c1a" : "#f2f0ec" });
      const img = await loadImage(shot.png);
      const out = document.createElement("canvas");
      out.width = shot.width;
      out.height = shot.height;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      // stroke widths are in screen pixels; the capture is w x h of those
      paint(ctx, strokes.current.map((s) => ({ ...s, width: s.width / k() })), out.width, out.height);
      onSend({ name: "annotated-view.png", mime: "image/png", data: out.toDataURL("image/png").split(",")[1] });
      clear();
      onClose();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <canvas
        ref={canvas}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 4, cursor: "crosshair", touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = { color, width: width * k(), pts: [at(e)] };
          redraw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current.pts.push(at(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          strokes.current.push(current.current);
          current.current = null;
          setCount(strokes.current.length);
          redraw();
        }}
      />
      <Group
        data-vp-ui
        gap={8}
        px={8}
        py={6}
        pos="absolute"
        top={10}
        left={12}
        right={56}
        bg="var(--surface)"
        bd="1px solid var(--border)"
        style={{ borderRadius: 8, boxShadow: "var(--shadow)", zIndex: 6 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Group gap={4} wrap="nowrap" role="radiogroup" aria-label={t("annotate.color")}>
          {COLORS.map((c) => (
            <UnstyledButton
              key={c}
              role="radio"
              aria-checked={color === c}
              title={c}
              aria-label={c}
              onClick={() => setColor(c)}
              bd="1px solid var(--border)"
              style={{ width: 20, height: 20, borderRadius: "50%", background: c, outline: color === c ? "2px solid var(--accent)" : undefined, outlineOffset: 1 }}
            />
          ))}
          <ColorInput size="xs" w={92} value={color} aria-label={t("annotate.color")} onChange={setColor} format="hex" withPicker={false} swatches={COLORS} />
        </Group>
        <Group gap={8} wrap="nowrap" title={t("annotate.width")}>
          <Slider w={110} size="sm" label={null} min={1} max={30} value={width} aria-label={t("annotate.width")} onChange={setWidth} />
          <Box component="i" bd="1px solid var(--border)" style={{ display: "inline-block", borderRadius: "50%", flex: "none", width: Math.max(width, 3), height: Math.max(width, 3), background: color }} />
        </Group>
        <Button size="compact-xs" variant="default" onClick={undo} disabled={count === 0}>{t("annotate.undo")}</Button>
        <Button size="compact-xs" variant="default" onClick={clear} disabled={count === 0}>{t("annotate.clear")}</Button>
        <Box flex={1} />
        {problem && <Text c="var(--bad)" fz={12}>{problem}</Text>}
        <Button size="compact-xs" leftSection={<Icon name="send" size={14} />} onClick={send} disabled={!viewer}>
          {t("annotate.send")}
        </Button>
        <Button size="compact-xs" variant="default" onClick={onClose}>{t("annotate.done")}</Button>
      </Group>
    </>
  );
}
