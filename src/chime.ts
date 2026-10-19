import { useSyncExternalStore } from "react";
import { getPref, setPref } from "./prefs";

/** A round of design that took at least this long ends with a chime. */
export const DEFAULT_CHIME_SECS = 20;

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const chimeOn = () => getPref<boolean>("chimeOn") !== false;
export const chimeSecs = () => {
  const s = getPref<number>("chimeSecs");
  return typeof s === "number" && Number.isFinite(s) && s >= 0 ? s : DEFAULT_CHIME_SECS;
};

export function setChimeOn(on: boolean) {
  setPref("chimeOn", on);
  changed();
}
export function setChimeSecs(secs: number) {
  setPref("chimeSecs", Math.max(0, Math.round(secs)));
  changed();
}

/** The chime settings as React state, shared by everything that shows them. */
export function useChime() {
  const on = useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), chimeOn);
  const secs = useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), chimeSecs);
  return { on, secs };
}

let ctx: AudioContext | null = null;
let lastPlayed = 0;

/** Whether a chime has played since `time` (ms since the epoch), e.g. one the agent asked for itself. */
export const chimedSince = (time: number) => lastPlayed >= time;

/** Two soft notes, made on the spot so there is no sound file to ship. */
export function playChime() {
  lastPlayed = Date.now();
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const start = t0 + i * 0.16;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.75);
    });
  } catch {
    // no audio device or the webview blocked it: the chime is a nicety, not worth an error
  }
}
