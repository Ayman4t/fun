"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectArena } from "@/lib/realtime/socketClient";
import { chant, initAudio, setMuted, tapSound, whistle } from "@/lib/audio/soundEffects";
import { cn } from "@/lib/utils";
import RopeCanvas from "./RopeCanvas";
import VictoryModal from "./VictoryModal";
import type { ArenaState, Team } from "../../../party/types";

const OFFLINE: ArenaState = {
  t: "state", pos: 0, wcps: 0, scps: 0, live: 0, status: "active",
  round: 1, tw: 0, ts: 0, startedAt: 0, elapsedMs: 0, resumeIn: 0,
};
const TAP_NUDGE = 0.15; // optimistic nudge, ±100 display scale
const MAX_CPS = 25;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const ZONES = {
  summer: {
    name: "تيم الصيف", icon: "😎☀️", tag: "بحر وسهر ومانجا وبلا كآبة",
    join: "انضم للصيف واضغط 🔥", cheer: "شِد معاهم الصيف بيغرق!",
    bg: "bg-gradient-to-br from-amber-600 via-orange-600 to-red-700", btn: "text-orange-600", fx: "heat",
  },
  winter: {
    name: "تيم الشتا", icon: "🧣❄️", tag: "هوت شوكليت وبطانية وراحة بال",
    join: "انضم للشتا واضغط ❄️", cheer: "شِد حيلك الشتا لازم ينتصر!",
    bg: "bg-gradient-to-bl from-sky-700 via-blue-800 to-slate-950", btn: "text-sky-800", fx: "snow",
  },
} as const;

function Zone({ side, team, onJoin }: { side: Team; team: Team | null; onJoin: (t: Team) => void }) {
  const z = ZONES[side];
  return (
    <div dir="rtl" className={cn("relative flex flex-col items-center justify-center overflow-hidden p-4 text-center text-white transition-opacity", z.bg, team && team !== side && "opacity-70")}>
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", z.fx)} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-5xl">{z.icon}</div>
        <h2 className="mt-1 text-2xl font-black">{z.name}</h2>
        <p className="text-xs font-semibold opacity-90">{z.tag}</p>
        {!team && (
          <button onClick={() => onJoin(side)} className={cn("z-40 mt-4 rounded-2xl bg-white px-5 py-3 text-lg font-black shadow-2xl transition active:scale-95", z.btn)}>
            {z.join}
          </button>
        )}
        {team === side && (
          <div className="pointer-events-none mt-20 animate-pulse text-4xl font-black">
            اضغط بجنون!
            <p className="mt-1 text-sm font-semibold opacity-90">{z.cheer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TugArena() {
  const [team, setTeam] = useState<Team | null>(null);
  const [srv, setSrv] = useState<ArenaState>(OFFLINE);
  const [offset, setOffset] = useState(0); // taps the server hasn't absorbed yet
  const [mine, setMine] = useState(0);
  const [muted, setMutedState] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const link = useRef<ReturnType<typeof connectArena> | null>(null);
  const taps = useRef<number[]>([]);
  const lastShake = useRef(0);
  const lead = useRef(0);
  const ema = useRef({ w: 0, s: 0 });
  const lastSurge = useRef(0);

  const shake = useCallback(() => {
    const el = root.current;
    if (!el) return;
    el.classList.remove("shake-screen");
    void el.offsetWidth;
    el.classList.add("shake-screen");
  }, []);

  useEffect(() => {
    const c = connectArena((s) => {
      setSrv(s);
      setOffset((o) => o * 0.6); // server has absorbed the batch -> fade the optimistic part
    });
    link.current = c;
    return () => c.close();
  }, []);

  useEffect(() => setMine(0), [srv.round]);

  // whistle on a change of lead, shake + chant on a collective surge
  useEffect(() => {
    const l = srv.pos > 80 ? 1 : srv.pos < -80 ? -1 : lead.current;
    if (lead.current !== 0 && l !== lead.current) whistle();
    lead.current = l;

    const e = ema.current;
    const now = performance.now();
    const surge = (e.w > 50 && srv.wcps > e.w * 1.4) || (e.s > 50 && srv.scps > e.s * 1.4);
    e.w = e.w * 0.9 + srv.wcps * 0.1;
    e.s = e.s * 0.9 + srv.scps * 0.1;
    if (surge && now - lastSurge.current > 3000) {
      lastSurge.current = now;
      shake();
      chant();
    }
  }, [srv, shake]);

  const join = (t: Team) => {
    initAudio();
    setTeam(t);
    link.current?.setTeam(t);
  };

  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!team || srv.status !== "active") return;
      if ((e.target as HTMLElement).closest("button")) return;
      const now = performance.now();
      taps.current = taps.current.filter((x) => now - x < 1000);
      if (taps.current.length >= MAX_CPS) return;
      taps.current.push(now);
      navigator.vibrate?.(15);
      tapSound(taps.current.length);
      link.current?.tap();
      setMine((m) => m + 1);
      setOffset((o) => clamp(o + (team === "winter" ? TAP_NUDGE : -TAP_NUDGE), -15, 15));
      if (taps.current.length >= 10 && now - lastShake.current > 700) {
        lastShake.current = now;
        shake();
      }
    },
    [team, srv.status, shake]
  );

  const position = clamp(srv.pos / 10 + offset, -100, 100); // display scale ±100
  const taunt =
    position > 15 ? "🔥 تيم الشتا بيسحل تيم الصيف ومقرب يكسب!"
    : position < -15 ? "☀️ تيم الصيف مبهدل تيم الشتا في ملعبه!"
    : "⚖️ المعركة حامية ومفيش حد راضي يستسلم!";
  const ended = srv.status !== "active";

  return (
    // dir="ltr" keeps Summer on the left / Winter on the right regardless of the page's RTL
    <div ref={root} dir="ltr" className="relative flex h-[100dvh] w-full touch-none select-none flex-col overflow-hidden" onPointerDown={handleTap}>
      <header className="absolute inset-x-0 top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/10 bg-black/60 p-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-xs font-black text-white backdrop-blur-md">
        <span className="text-left text-amber-400">☀️ الصيف: {fmt(srv.scps)}/ث</span>
        <span dir="rtl" className="text-center text-[11px]">
          <span className="ml-1.5 inline-block h-2 w-2 animate-ping rounded-full bg-red-500" />
          {srv.live ? `${fmt(srv.live)} بيشدوا دلوقتي` : "بيتصل بالساحة..."}
        </span>
        <span className="text-right text-sky-400">❄️ الشتا: {fmt(srv.wcps)}/ث</span>
      </header>

      <div className="grid flex-1 grid-cols-2">
        <Zone side="summer" team={team} onJoin={join} />
        <Zone side="winter" team={team} onJoin={join} />
      </div>

      <RopeCanvas position={position} />

      <footer dir="rtl" className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-1.5 border-t border-white/10 bg-slate-950/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div dir="ltr" className="flex h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${50 - position * 0.5}%` }} />
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${50 + position * 0.5}%` }} />
        </div>
        <p className="text-xs font-bold text-slate-300">{taunt}</p>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>{team ? `مساهمتك: ${mine} ضغطة` : "اختار تيمك الأول"}</span>
          <button
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
            onClick={() => { setMutedState(!muted); setMuted(!muted); }}
            className="rounded-full bg-white/10 px-2 py-0.5 text-sm"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </footer>

      {ended && (
        <VictoryModal
          key={srv.round}
          winner={srv.status === "winter_won" ? "winter" : "summer"}
          total={srv.tw + srv.ts}
          durationSec={Math.round(srv.elapsedMs / 1000)}
          mine={mine}
          resumeIn={srv.resumeIn}
        />
      )}
    </div>
  );
}
