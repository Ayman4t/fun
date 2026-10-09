"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Share2 } from "lucide-react";
import { certificateText, renderCertificate } from "@/lib/certificate";
import { victory, zaghrouda } from "@/lib/audio/soundEffects";
import type { Team } from "../../../party/types";

type Props = { winner: Team; total: number; durationSec: number; mine: number; resumeIn: number };

export default function VictoryModal({ winner, total, durationSec, mine, resumeIn }: Props) {
  const [img, setImg] = useState("");
  const input = { winner, total, durationSec, mine };
  const text = certificateText(input);

  useEffect(() => {
    victory();
    zaghrouda();
    let raf = 0;
    let alive = true;
    const stopAt = Date.now() + 2500;
    const burst = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
      if (Date.now() < stopAt) raf = requestAnimationFrame(burst);
    };
    burst();
    renderCertificate(input).then((u) => alive && setImg(u));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      confetti.reset();
    };
    // mounted once per round (parent passes key=round)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = async () => {
    const msg = `🏆 ${text}\nتعالى شد معانا: ${location.origin}`;
    try {
      if (img && navigator.canShare) {
        const blob = await (await fetch(img)).blob();
        const file = new File([blob], "shad-elhabl.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: msg });
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // player closed the share sheet
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  return (
    <div dir="rtl" className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-auto bg-slate-950/95 p-4 text-center text-white">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="وثيقة نصر ساحقة" className="w-[min(78vw,340px)] rounded-xl shadow-2xl" />
      ) : (
        <div className="grid h-72 w-[min(78vw,340px)] place-items-center rounded-xl bg-slate-800 text-sm">بنجهز الوثيقة...</div>
      )}
      <button onClick={share} className="flex items-center gap-2 rounded-2xl bg-green-500 px-5 py-3 text-base font-black text-white shadow-2xl transition active:scale-95">
        <Share2 className="h-5 w-5" />
        عَيّر أصحابك في جروب واتساب واحتفل
      </button>
      <p className="text-sm font-bold text-amber-300">الجولة الجاية بعد {Math.ceil(resumeIn / 1000)} ثانية</p>
    </div>
  );
}
