import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "running" | "denied" | "unsupported";

interface DMEPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

/**
 * Lightweight step counter using DeviceMotion.
 * Peak-detection on magnitude of acceleration with a small refractory window.
 * Returns live count for the current session; caller is responsible for
 * persisting to storage when stopped.
 */
export function useStepCounter(initial = 0) {
  const [steps, setSteps] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const lastPeakRef = useRef(0);
  const emaRef = useRef(9.81); // gravity baseline
  const handlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  // Reset to a new baseline (e.g. when today's saved step count changes).
  useEffect(() => { setSteps(initial); }, [initial]);

  const stop = useCallback(() => {
    if (handlerRef.current) {
      window.removeEventListener("devicemotion", handlerRef.current);
      handlerRef.current = null;
    }
    setStatus(s => (s === "running" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      setStatus("unsupported");
      return;
    }
    const DM = DeviceMotionEvent as unknown as DMEPermission;
    if (typeof DM.requestPermission === "function") {
      try {
        const res = await DM.requestPermission();
        if (res !== "granted") { setStatus("denied"); return; }
      } catch { setStatus("denied"); return; }
    }

    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      // Low-pass to estimate gravity, then subtract to get linear accel magnitude.
      emaRef.current = emaRef.current * 0.9 + mag * 0.1;
      const linear = Math.abs(mag - emaRef.current);
      const now = Date.now();
      // Threshold ~1.2 m/s^2, refractory 320ms (max ~3 steps/sec).
      if (linear > 1.2 && now - lastPeakRef.current > 320) {
        lastPeakRef.current = now;
        setSteps(s => s + 1);
      }
    };
    handlerRef.current = handler;
    window.addEventListener("devicemotion", handler);
    setStatus("running");
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { steps, status, start, stop, setSteps };
}
