import type { Team } from "../../party/types";

export type CertInput = { winner: Team; total: number; durationSec: number; mine: number };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function certificateText({ winner, total, durationSec }: CertInput) {
  const win = winner === "winter" ? "تيم الشتا ❄️" : "تيم الصيف ☀️";
  const lose = winner === "winter" ? "تيم الصيف" : "تيم الشتا";
  const dur = durationSec >= 90 ? `${Math.round(durationSec / 60)} دقيقة` : `${durationSec} ثانية`;
  return `${win} سحق ${lose} بعد ${fmt(total)} ضغطة في معركة دامت ${dur}!`;
}

export function contributionText(mine: number) {
  if (mine <= 0) return "";
  const rank = mine >= 300 ? "مقاتل صف أول" : mine >= 100 ? "مقاتل شرس" : "مقاتل";
  return `مساهمتك: ${fmt(mine)} ضغطة (${rank})`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, y);
      y += lh;
      line = word;
    } else line = test;
  }
  ctx.fillText(line, cx, y);
  return y;
}

/** Draws the shareable "وثيقة نصر ساحقة" card and returns a PNG data URL. */
export async function renderCertificate(input: CertInput): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily; // next/font's generated Cairo family
  try { await document.fonts.load(`900 40px ${family}`); } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(1.5, 1.5); // draw on a 720x900 grid
  const win = input.winner === "winter";

  const g = ctx.createLinearGradient(0, 0, 720, 900);
  g.addColorStop(0, win ? "#0369a1" : "#ea580c");
  g.addColorStop(1, win ? "#020617" : "#7f1d1d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, 900);

  // deterministic confetti dots
  let seed = input.total % 9973 || 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    ctx.fillStyle = `hsla(${Math.floor(rnd() * 360)},90%,60%,.7)`;
    ctx.fillRect(rnd() * 720, rnd() * 900, 8, 14);
  }

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, 672, 852);
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, 640, 820);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "80px sans-serif";
  ctx.fillText("🏆", 360, 170);
  ctx.font = `900 54px ${family}`;
  ctx.fillText("وثيقة نصر ساحقة", 360, 270);
  ctx.font = `700 36px ${family}`;
  const y = wrap(ctx, certificateText(input), 360, 370, 580, 60);

  const role = contributionText(input.mine);
  if (role) {
    ctx.fillStyle = "#fbbf24";
    ctx.font = `900 34px ${family}`;
    wrap(ctx, role, 360, y + 90, 580, 50);
  }
  ctx.fillStyle = "#fff";
  ctx.font = `700 26px ${family}`;
  ctx.fillText("شد الحبل القومي — تحداهم تاني!", 360, 820);
  return canvas.toDataURL("image/png");
}
