import PartySocket from "partysocket";
import type { ArenaState, Team } from "../../../party/types";

const HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
const SHARDS = Number(process.env.NEXT_PUBLIC_SHARDS ?? 16);
const FLUSH_MS = 250;

/** Connects to a random shard, batches taps and flushes them every 250ms. */
export function connectArena(onState: (s: ArenaState) => void) {
  const ws = new PartySocket({ host: HOST, party: "shard", room: `s${Math.floor(Math.random() * SHARDS)}` });
  let team: Team | null = null;
  let buf = 0;

  ws.addEventListener("message", (e) => {
    try {
      const m = JSON.parse(e.data as string);
      if (m.t === "state") onState(m as ArenaState);
    } catch {}
  });

  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) { buf = 0; return; } // don't replay stale taps after a reconnect
    if (buf > 0 && team) {
      ws.send(JSON.stringify({ t: "pull", team, clicks: buf }));
      buf = 0;
    }
  }, FLUSH_MS);

  return {
    setTeam: (t: Team) => { team = t; },
    tap: () => { buf++; },
    close: () => { clearInterval(timer); ws.close(); },
  };
}
