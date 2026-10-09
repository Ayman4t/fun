"use client";

import { useEffect, useRef } from "react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Physical rope: it sags when the fight is slack, goes taut and trembles when the
 * bandana is moving fast, and the red cloth swings with a lag behind the pull.
 * `position` is -100 (Summer wins) .. +100 (Winter wins).
 */
export default function RopeCanvas({ position }: { position: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(position);
  target.current = position;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const family = getComputedStyle(document.body).fontFamily;
    let w = 0, h = 0, raf = 0;
    let cur = target.current;
    let swing = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (ms: number) => {
      const t = ms / 1000;
      const diff = target.current - cur;
      cur += diff * 0.18;
      const tension = Math.min(1, Math.abs(diff) * 0.8);
      swing += (diff * 6 - swing) * 0.2;

      ctx.clearRect(0, 0, w, h);
      const cy = h / 2;
      const sag = (1 - tension) * 7;
      const amp = tension * 3;
      const yAt = (x: number) => cy + sag * Math.sin((Math.PI * x) / w) + amp * Math.sin(x * 0.09 + t * 38);

      const stroke = (lw: number, color: string, dash: number[], off: number) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)));
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.setLineDash(dash);
        ctx.lineDashOffset = off;
        ctx.stroke();
      };
      ctx.lineCap = "round";
      stroke(16, "#451a03", [], 0);
      stroke(11, "#b45309", [], 0);
      stroke(11, "rgba(252,211,77,.55)", [8, 14], -cur * 4);
      ctx.setLineDash([]);

      // victory lines (Summer left, Winter right)
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      for (const [x, c] of [[w * 0.15, "#fb923c"], [w * 0.85, "#38bdf8"]] as const) {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.moveTo(x, cy - 36);
        ctx.lineTo(x, cy + 36);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // bandana
      const bx = w * (0.5 + cur * 0.004);
      const by = yAt(bx);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(((clamp(swing, -35, 35) + Math.sin(t * 30) * tension * 8) * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(-19, 6);
      ctx.lineTo(19, 6);
      ctx.lineTo(19, 50);
      ctx.quadraticCurveTo(10, 44, 0, 50);
      ctx.quadraticCurveTo(-10, 56, -19, 50);
      ctx.closePath();
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(0, 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `900 11px ${family}`;
      ctx.textAlign = "center";
      ctx.fillText("هيلا", 0, 34);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-24 w-full -translate-y-1/2" />;
}
