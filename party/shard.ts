import type * as Party from "partykit/server";
import { CONFIG, type BatchMsg, type ClientMsg } from "./types";

type Meta = { tokens: number; last: number; batches: number[] };

/**
 * Edge shard (rooms "s0".."sN"). Holds the player WebSockets, enforces the
 * per-connection limits, sums clicks and forwards ONE small batch to the arena
 * every 250ms. It relays the arena's state back to its own players.
 */
export default class Shard implements Party.Server {
  w = 0;
  s = 0;
  meta = new Map<string, Meta>();
  state?: string;
  timer?: ReturnType<typeof setInterval>;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.meta.set(conn.id, { tokens: CONFIG.maxCps, last: Date.now(), batches: [] });
    if (this.state) conn.send(this.state); // late joiners see the current round immediately
    if (!this.timer) this.timer = setInterval(() => this.flush(), CONFIG.flushMs);
  }

  onClose(conn: Party.Connection) {
    this.meta.delete(conn.id);
  }

  onMessage(raw: string, conn: Party.Connection) {
    let m: ClientMsg;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m?.t !== "pull" || (m.team !== "winter" && m.team !== "summer")) return;
    const meta = this.meta.get(conn.id);
    if (!meta) return;

    // 1) hard cap: token bucket refilled at maxCps (excess is clamped, never errors)
    const now = Date.now();
    meta.tokens = Math.min(CONFIG.maxCps, meta.tokens + ((now - meta.last) / 1000) * CONFIG.maxCps);
    meta.last = now;
    let n = Math.floor(Number(m.clicks));
    if (!(n > 0)) return;
    n = Math.min(n, Math.floor(meta.tokens));
    if (n <= 0) return;
    meta.tokens -= n;

    // 2) entropy check on batch sizes: a script sends the same count every flush,
    //    humans don't. Dropped silently (the client still sees normal acks).
    meta.batches.push(n);
    if (meta.batches.length > 12) meta.batches.shift();
    if (n >= 3 && meta.batches.length === 12 && meta.batches.every((b) => b === n)) return;

    if (m.team === "winter") this.w += n;
    else this.s += n;
  }

  flush() {
    if (this.meta.size === 0) {
      clearInterval(this.timer);
      this.timer = undefined;
      return;
    }
    const body: BatchMsg = { shard: this.room.id, w: this.w, s: this.s, conns: this.meta.size };
    this.w = 0;
    this.s = 0;
    this.room.context.parties.main
      .get("arena")
      .fetch({ method: "POST", headers: { "x-arena-key": this.room.env.ARENA_KEY as string }, body: JSON.stringify(body) })
      .catch(() => {});
  }

  /** state pushed down by the arena */
  async onRequest(req: Request) {
    if (req.method !== "POST" || req.headers.get("x-arena-key") !== (this.room.env.ARENA_KEY as string)) {
      return new Response("unauthorized", { status: 401 });
    }
    this.state = await req.text();
    this.room.broadcast(this.state);
    return new Response("ok");
  }
}
