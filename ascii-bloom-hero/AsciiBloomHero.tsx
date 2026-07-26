"use client";

/**
 * AsciiBloomHero
 *
 * A full-viewport ASCII/canvas hero animation with four phases:
 *   BLOOM  -> ambient noise field fades in as ASCII density characters
 *   IDLE   -> gentle ambient motion, waiting for user interaction
 *   DROP   -> click/tap triggers a physics-based "fall and settle" of every character
 *   HANDOFF -> once settled, fades out and reports the resting particles via onSettle,
 *              then calls onRelease so the parent can reveal page content underneath
 *
 * Zero dependencies beyond React. Drop this file into any React 18+ / Next.js
 * project (client component) and render <AsciiBloomHero />.
 */

import { useEffect, useRef, useState, useMemo } from "react";

const RAMP = " .:-=+*#%@";
const GRAVITY = 900;

type Phase = "BLOOM" | "IDLE" | "DROP" | "HANDOFF";

export type SettledParticle = {
  x: number;
  y: number;
  ch: string;
  color: string;
};

type Cell = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ch: string;
  rest: boolean;
  drift: number;
  opacity: number;
  settledAt: number;
};

type Pulse = {
  ox: number;
  oy: number;
  start: number;
  duration: number;
};

const BLOOM_DUR = 3.5;
const PULSE_DUR = 2.5;
const FLOOR_PAD = 14;

export type AsciiBloomHeroProps = {
  /** Called once, right when particles come to rest, with their final positions. */
  onSettle?: (particles: SettledParticle[]) => void;
  /** Called ~700ms after settling, when the hero is about to fade out of the layout. */
  onRelease?: () => void;
  /** Monospace font family used for the ASCII characters. Defaults to system monospace. */
  fontFamily?: string;
};

export default function AsciiBloomHero({
  onSettle,
  onRelease,
  fontFamily = "'JetBrains Mono', ui-monospace, monospace",
}: AsciiBloomHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const clickLabelRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pointerFine = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(pointer: fine)").matches;
  }, []);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [phase, setPhase] = useState<Phase>("BLOOM");
  const [released, setReleased] = useState(false);

  const sr = useRef({
    w: 0,
    h: 0,
    dpr: 1,
    cell: 14,
    cols: 0,
    rows: 0,
    cells: [] as Cell[],
    phase: "BLOOM" as Phase,
    mountTime: 0,
    lastTime: 0,
    dropStartTime: 0,
    handoffAt: 0,
    mx: 0.5,
    my: 0.5,
    mouseActive: false,
    pulses: [] as Pulse[],
    nextPulseAt: 0,
  });

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Reset ALL state on every mount so StrictMode remounts and reloads
    // always replay from the very beginning (bloom -> idle -> ...).
    const srn = sr.current;
    srn.phase = "BLOOM";
    srn.cells = [];
    srn.pulses = [];
    srn.dropStartTime = 0;
    srn.handoffAt = 0;
    srn.mx = 0.5;
    srn.my = 0.5;
    srn.mouseActive = false;
    srn.mountTime = performance.now();
    srn.lastTime = srn.mountTime;
    srn.nextPulseAt = prefersReducedMotion
      ? Infinity
      : srn.mountTime + (6 + Math.random() * 4) * 1000;
    const effectiveBloomDur = prefersReducedMotion ? 0 : BLOOM_DUR;
    setPhase("BLOOM");
    setReleased(false);

    const vBase = (nx: number, ny: number, t: number) => {
      return (
        (Math.sin(nx * 9 + t * 0.9) * 0.5 +
          Math.cos(ny * 7 - t * 0.7) * 0.5 +
          Math.sin((nx + ny) * 6 + t * 1.3) * 0.6 +
          Math.sin(Math.hypot(nx - 0.5, ny - 0.5) * 14 - t * 1.6) * 0.7 +
          2.3) /
        4.6
      );
    };

    const rippleAt = (
      nx: number,
      ny: number,
      ox: number,
      oy: number,
      rt: number,
      duration: number
    ) => {
      if (rt < 0 || rt > duration) return 0;
      const dist = Math.hypot(nx - ox, ny - oy);
      const wave = Math.sin(dist * 40 - rt * 7);
      const env = Math.exp(-Math.pow(dist * 8 - rt * 3.6, 2));
      const amp = Math.max(0, 1 - rt / duration);
      return wave * env * amp;
    };

    const buildGrid = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      srn.w = Math.max(1, Math.floor(rect.width));
      srn.h = Math.max(1, Math.floor(rect.height));
      srn.dpr = dpr;
      srn.cols = Math.max(1, Math.floor(srn.w / srn.cell));
      srn.rows = Math.max(1, Math.floor(srn.h / srn.cell));
      canvas.width = Math.floor(srn.w * dpr);
      canvas.height = Math.floor(srn.h * dpr);
      canvas.style.width = srn.w + "px";
      canvas.style.height = srn.h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (srn.phase === "BLOOM" || srn.phase === "IDLE") {
        const cells: Cell[] = [];
        for (let r = 0; r < srn.rows; r++) {
          for (let c = 0; c < srn.cols; c++) {
            cells.push({
              x: c * srn.cell + srn.cell / 2,
              y: r * srn.cell + srn.cell / 2,
              vx: 0,
              vy: 0,
              ch: " ",
              rest: false,
              drift: Math.random() * Math.PI * 2,
              opacity: 1,
              settledAt: 0,
            });
          }
        }
        srn.cells = cells;
      }
    };

    const drop = () => {
      srn.phase = "DROP";
      setPhase("DROP");
      srn.dropStartTime = performance.now();
      srn.pulses = [];
      for (const p of srn.cells) {
        p.vx = (Math.random() - 0.5) * 60;
        p.vy = -(Math.random() * 60 + 20);
        p.rest = false;
        p.settledAt = 0;
      }
    };

    const performHandoff = () => {
      const floor = srn.h - FLOOR_PAD;
      const settled: SettledParticle[] = [];
      for (const p of srn.cells) {
        if (p.ch === " ") continue;
        settled.push({
          x: p.x,
          y: floor,
          ch: p.ch,
          color: "#fff", // matches this component's DROP-phase fill style
        });
      }
      onSettle?.(settled);
      srn.handoffAt = performance.now();
      srn.phase = "HANDOFF";
      setPhase("HANDOFF");

      // After a clean pause beat, reveal whatever sits below the hero.
      window.setTimeout(() => {
        setReleased(true);
        onRelease?.();
      }, 700);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - srn.lastTime) / 1000, 0.05);
      srn.lastTime = now;
      const elapsed = (now - srn.mountTime) / 1000;

      // During HANDOFF, fade canvas to black then stop rendering particles here.
      if (srn.phase === "HANDOFF") {
        const ho = now - srn.handoffAt;
        const fade = Math.min(1, ho / 600);
        ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.75 * fade})`;
        ctx.fillRect(0, 0, srn.w, srn.h);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, srn.w, srn.h);
      ctx.font = `${srn.cell}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (srn.phase === "BLOOM") {
        if (now >= srn.nextPulseAt && srn.pulses.length < 3) {
          srn.pulses.push({
            ox: Math.random(),
            oy: Math.random(),
            start: now,
            duration: PULSE_DUR,
          });
          srn.nextPulseAt = now + (5 + Math.random() * 5) * 1000;
        }
        srn.pulses = srn.pulses.filter((pl) => now - pl.start < pl.duration);

        if (elapsed >= effectiveBloomDur) {
          srn.phase = "IDLE";
          setPhase("IDLE");
        }
        for (const p of srn.cells) {
          const nx = p.x / srn.w;
          const ny = p.y / srn.h;
          if (Math.hypot(nx - 0.5, ny - 0.5) * 8 > elapsed * 3.6 + 2) {
            p.ch = " ";
            continue;
          }
          let v = vBase(nx, ny, elapsed);
          v += rippleAt(nx, ny, 0.5, 0.5, elapsed - 0, BLOOM_DUR);
          v += rippleAt(nx, ny, 0.5, 0.5, elapsed - 0.7, BLOOM_DUR);
          if (srn.mouseActive) {
            const dc = Math.hypot(nx - srn.mx, ny - srn.my);
            v += Math.exp(-Math.pow(dc * 10, 2)) * 0.8;
          }
          for (const pl of srn.pulses) {
            v += rippleAt(nx, ny, pl.ox, pl.oy, (now - pl.start) / 1000, pl.duration);
          }
          v = Math.max(0, Math.min(1, v));
          p.ch = RAMP[Math.floor(v * (RAMP.length - 1))];
          const g = Math.floor(45 + v * 210);
          ctx.fillStyle = `rgba(${g},${g},${g},${0.55 + v * 0.4})`;
          ctx.fillText(p.ch, p.x, p.y);
        }
      } else if (srn.phase === "IDLE") {
        if (now >= srn.nextPulseAt && srn.pulses.length < 3) {
          srn.pulses.push({
            ox: Math.random(),
            oy: Math.random(),
            start: now,
            duration: PULSE_DUR,
          });
          srn.nextPulseAt = now + (6 + Math.random() * 4) * 1000;
        }
        srn.pulses = srn.pulses.filter((pl) => now - pl.start < pl.duration);

        for (const p of srn.cells) {
          const nx = p.x / srn.w;
          const ny = p.y / srn.h;
          let v = vBase(nx, ny, elapsed);
          if (srn.mouseActive) {
            const dc = Math.hypot(nx - srn.mx, ny - srn.my);
            v += Math.exp(-Math.pow(dc * 10, 2)) * 0.8;
          }
          for (const pl of srn.pulses) {
            v += rippleAt(nx, ny, pl.ox, pl.oy, (now - pl.start) / 1000, pl.duration);
          }
          v = Math.max(0, Math.min(1, v));
          p.ch = RAMP[Math.floor(v * (RAMP.length - 1))];
          const g = Math.floor(45 + v * 210);
          ctx.fillStyle = `rgba(${g},${g},${g},${0.55 + v * 0.4})`;
          ctx.fillText(p.ch, p.x, p.y);
        }
      } else if (srn.phase === "DROP") {
        const floor = srn.h - FLOOR_PAD;
        let allSettled = true;
        let anyNonEmpty = false;
        const sinceDrop = now - srn.dropStartTime;
        for (const p of srn.cells) {
          if (p.ch === " ") continue;
          anyNonEmpty = true;
          if (!p.rest) {
            p.vy += GRAVITY * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y >= floor) {
              p.y = floor;
              if (Math.abs(p.vy) < 40) {
                p.vy = 0;
                p.vx = 0;
                p.rest = true;
                p.settledAt = now;
              } else {
                p.vy *= -0.42;
                p.vx *= 0.7;
                allSettled = false; // still bouncing
              }
            } else {
              allSettled = false; // still airborne
            }
          } else {
            p.drift += dt * 0.8;
            p.x += Math.sin(p.drift) * 6 * dt;
          }
          ctx.fillStyle = "#fff";
          ctx.fillText(p.ch, p.x, p.y);
        }
        // Handoff only after a minimum drop duration AND all particles at rest
        // (or 5s failsafe). The min time ensures we always see the fall/bounce.
        if (
          anyNonEmpty &&
          sinceDrop > 1500 &&
          (allSettled || sinceDrop > 5000)
        ) {
          performHandoff();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    buildGrid();
    rafRef.current = requestAnimationFrame(loop);

    const onResize = () => buildGrid();

    const onMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      srn.mx = (e.clientX - rect.left) / rect.width;
      srn.my = (e.clientY - rect.top) / rect.height;
      srn.mouseActive = true;
      if (clickLabelRef.current) {
        clickLabelRef.current.style.left = e.clientX + "px";
        clickLabelRef.current.style.top = e.clientY + "px";
      }
    };

    const onDown = () => {
      if (srn.phase === "IDLE") drop();
    };

    window.addEventListener("resize", onResize);
    if (pointerFine) {
      wrap.addEventListener("pointermove", onMove);
    }
    wrap.addEventListener("pointerdown", onDown);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onDown);
    };
  }, [mounted, pointerFine, prefersReducedMotion, fontFamily]);

  const showPrompt = mounted && phase === "IDLE";
  const label = pointerFine ? "[CLICK]" : "TAP TO CONTINUE";

  // Lock body scroll while hero is the active overlay; unlock when released.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("ascii-bloom-hero-released", released);
    document.body.classList.toggle("ascii-bloom-hero-released", released);
  }, [released]);

  const rootStyle: React.CSSProperties = released
    ? {
        position: "relative",
        width: "100%",
        height: 0,
        background: "#000",
        cursor: "default",
        opacity: 0,
        transition: "opacity 0.6s ease, height 0s 0.6s",
        pointerEvents: "none",
        overflow: "hidden",
      }
    : {
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "#000",
        cursor: pointerFine && phase !== "DROP" ? "none" : "default",
        transition: "opacity 0.6s ease",
        opacity: phase === "HANDOFF" ? 0 : 1,
      };

  return (
    <section ref={wrapRef} style={rootStyle}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {showPrompt && (
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#555",
            fontSize: 12,
            letterSpacing: "3px",
            pointerEvents: "none",
            animation: pointerFine ? "none" : "blink 1.2s steps(2) infinite",
          }}
        >
          {label}
        </div>
      )}

      {pointerFine && showPrompt && (
        <div
          ref={clickLabelRef}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            transform: "translate(14px, 14px)",
            color: "#fff",
            fontSize: 11,
            letterSpacing: "2px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 90,
          }}
        >
          [CLICK]
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </section>
  );
}
