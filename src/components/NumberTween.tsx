import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

/** A number that glides to its new value instead of jumping. */
export function NumberTween({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.5,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value]);
  return <>{format(shown)}</>;
}
