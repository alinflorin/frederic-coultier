const PATHS: Record<string, string> = {
  send: "M3 11l18-8-8 18-2-8-8-2z",
  attach: "M21 11l-9 9a5 5 0 01-7-7l9-9a3 3 0 014 4l-9 9a1 1 0 01-2-2l8-8",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5",
  chat: "M4 5h16v11H9l-5 4z",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 19l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z",
  copy: "M8 8h11v12H8zM5 16V4h11",
  play: "M7 4l13 8-13 8z",
  check: "M5 12l5 5 9-10",
  warn: "M12 4l9 16H3zM12 10v4M12 17v.5",
  folder: "M3 6h6l2 2h10v11H3z",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  menu: "M4 7h16M4 12h16M4 17h16",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  grid: "M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16",
  ruler: "M3 15l12-12 6 6L9 21zM7 11l2 2M10 8l2 2M13 5l2 2",
  rotate: "M20 12a8 8 0 11-2.5-5.8M20 4v4h-4",
  layers: "M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5",
  ortho: "M5 8l7-4 7 4v8l-7 4-7-4zM5 8l7 4 7-4M12 12v8",
  supports: "M3 7h18M12 7v0M6 7v13M12 7v13M18 7v13M3 20h18",
  sprue: "M12 3v10M9 3h6M12 13l-6 4v4h12v-4z",
  axes: "M5 19V4M5 19h15M5 19l7-7M3 7l2-3 2 3M17 17l3 2-3 2",
  section: "M3 12h3M9 12h3M15 12h3M20 12h1M6 4h12v16H6z",
  plus: "M12 5v14M5 12h14",
  pen: "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M9 12h6M12 9v6",
  sparkle: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
