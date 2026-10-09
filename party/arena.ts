import type * as Party from "partykit/server";
import { CONFIG, type ArenaState, type BatchMsg, type Status } from "./types";

const RING = Math.round(1000 / CONFIG.tickMs); // 1-second window
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Single authoritative room (id "arena"). It never talks to players directly:
 * shards POST aggregated click batches here and receive the state back, so
 * fan-out cost stays at (#shards x 10/s) instead of (#players x 10/s).
 */
export default class Arena implements Party.Server {
  pos = 0;
  round = 1;
  status: Status = "active";
  tw = 0;
  ts = 0;
  startedAt = Date.now();
  resumeAt = 0;
  endedAt = 0;
  w = 0;
  s = 0;
  wRing = new Array<number>(RING).fill(0);
  sRing = new Array<number>(RING).fill(0);
  idx = 0;
  n = 0;
  shards = new Map<string, { conns: number; seen: number }>();
  timer?: ReturnType<typeof setInterval>;

  constructor(readonly room: Party.Room) {}

  private authed(req: Party.Request) {
    return req.headers.get("x-arena-key") === (this.room.env.ARENA_KEY as string);
  }

  async onRequest(req: Party.Request) {
    if (!this.authed(req)) return new Response("unauthorized", { status: 401 });
    if (req.method === "GET") return Response.json(this.state());
    const b = (await req.json()) as BatchMsg;
    // never trust a shard blindly: bound a batch by what its connections could physically send
    const cap = Math.ceil(b.conns * CONFIG.maxCps * (CONFIG.flushMs / 1000) * 1.5);
    if (this.status === "active") {
      this.w += clamp(Math.floor(b.w) || 0, 0, cap);
      this.s += clamp(Math.floor(b.s) || 0, 0, cap);
    }
    this.shards.set(b.shard, { conns: b.conns, seen: Date.now() });
    this.ensureLoop();
    return new Response("ok");
  }

  ensureLoop() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), CONFIG.tickMs);
  }

  tick() {
    const now = Date.now();
    for (const [id, v] of this.shards) if (now - v.seen > 5000) this.shards.delete(id);

    if (this.status === "active") {
      const { w, s } = this;
      // share-based pull: scale-free, so 200 or 200,000 players feel the same
      this.pos += (CONFIG.gain * (w - s)) / (w + s + CONFIG.floor);
      this.pos -= this.pos * CONFIG.friction;
      this.pos = clamp(this.pos, -CONFIG.range, CONFIG.range);
      this.tw += w;
      this.ts += s;
      if (this.pos >= CONFIG.goal) this.end("winter_won", now);
      else if (this.pos <= -CONFIG.goal) this.end("summer_won", now);
    } else if (now >= this.resumeAt) {
      this.reset(now);
    }

    this.wRing[this.idx] = this.w;
    this.sRing[this.idx] = this.s;
    this.idx = (this.idx + 1) % RING;
    this.w = 0;
    this.s = 0;

    if (++this.n % (CONFIG.broadcastMs / CONFIG.tickMs) === 0) this.broadcast();

    if (this.shards.size === 0 && this.status === "active") {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  end(status: Status, now: number) {
    this.status = status;
    this.pos = status === "winter_won" ? CONFIG.goal : -CONFIG.goal;
    this.endedAt = now;
    this.resumeAt = now + CONFIG.pauseMs;
  }

  reset(now: number) {
    this.status = "active";
    this.pos = 0;
    this.tw = 0;
    this.ts = 0;
    this.round++;
    this.startedAt = now;
    this.resumeAt = 0;
  }

  state(): ArenaState {
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    let live = 0;
    for (const v of this.shards.values()) live += v.conns;
    return {
      t: "state",
      pos: Math.round(this.pos * 10) / 10,
      wcps: sum(this.wRing),
      scps: sum(this.sRing),
      live,
      status: this.status,
      round: this.round,
      tw: this.tw,
      ts: this.ts,
      startedAt: this.startedAt,
      elapsedMs: (this.status === "active" ? Date.now() : this.endedAt) - this.startedAt,
      resumeIn: this.status === "active" ? 0 : Math.max(0, this.resumeAt - Date.now()),
    };
  }

  broadcast() {
    const body = JSON.stringify(this.state());
    for (const id of this.shards.keys()) {
      this.room.context.parties.shard
        .get(id)
        .fetch({ method: "POST", headers: { "x-arena-key": this.room.env.ARENA_KEY as string }, body })
        .catch(() => {});
    }
  }
}
