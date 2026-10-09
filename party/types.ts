export type Team = "winter" | "summer";
export type Status = "active" | "winter_won" | "summer_won";

export const CONFIG = {
  range: 1000,        // ropePosition lives in [-1000, +1000]; + = Winter side
  goal: 850,          // |pos| >= goal ends the round
  tickMs: 50,         // 20 physics ticks / second
  broadcastMs: 100,   // main -> shards state push
  flushMs: 250,       // client -> shard and shard -> main batching
  gain: 8,            // max units a 100% click-share lead moves per tick
  floor: 20,          // damps motion when the room is almost empty
  friction: 0.0002,   // per-tick pull back toward center
  maxCps: 25,         // per-connection cap (token bucket)
  pauseMs: 30_000,    // celebration pause between rounds
} as const;

/** client -> shard */
export type ClientMsg = { t: "pull"; team: Team; clicks: number };
/** shard -> main (HTTP POST) */
export type BatchMsg = { shard: string; w: number; s: number; conns: number };
/** main -> shards -> clients */
export type ArenaState = {
  t: "state";
  pos: number;        // -1000..1000
  wcps: number;       // winter clicks/sec (1s window)
  scps: number;       // summer clicks/sec
  live: number;       // connected players across all shards
  status: Status;
  round: number;
  tw: number;         // round totals
  ts: number;
  startedAt: number;  // epoch ms of round start (server clock)
  elapsedMs: number;  // round duration so far / final duration once ended
  resumeIn: number;   // ms until next round (0 while active)
};
