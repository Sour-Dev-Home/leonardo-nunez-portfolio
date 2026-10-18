import { backoffDelay } from "./backoff";

// Figure 1's model. Every rule follows the agent's code in Sour-Dev-Home/satisfactory-dash; only time
// is scaled so a reader can watch (the agent samples every 5 s and backs off 1 s → 60 s).
//  - agent/src/queue.ts        BoundedQueue: a push into a full queue drops the OLDEST.
//  - agent/src/pusher.ts       sends the head with peek(): it keeps its place until the backend accepts
//                              it, so it can be dropped while in flight; a transient error keeps it at
//                              the head and waits backoffDelayMs(failures) before counting the failure;
//                              success resets the failures and the next send follows at once.
//  - agent/src/backoff.ts      exponential, capped, equal jitter (./backoff.ts).
//  - agent/src/agentRunner.ts  QUEUE_MAX_SNAPSHOTS = 120 (about ten minutes); the figure shows 12 places.

export type Target = "tunnel" | "backend" | "db";
export interface OutageTiming {
  sampleEvery: number;
  arrive: number;
  minDwell: number;
  trip: Record<Target, number>;
  drainFactor: number;
  backoffBase: number;
  backoffMax: number;
}
export const SCALED: OutageTiming = {
  sampleEvery: 1.6,
  arrive: 0.9,
  minDwell: 0.2,
  trip: { tunnel: 0.5, backend: 0.85, db: 1.1 },
  drainFactor: 0.4,
  backoffBase: 0.6,
  backoffMax: 6,
};
export const CAPACITY = 12;

export interface Snapshot {
  id: number;
  takenAt: number;
  seatedAt: number | null;
}
export interface Flight {
  id: number;
  target: Target;
  ok: boolean;
  phase: "out" | "back";
  startedAt: number;
  duration: number;
  dropped: boolean;
}
export type OutageEvent =
  | { kind: "sampled"; id: number }
  | { kind: "dropped"; id: number; inFlight: boolean }
  | { kind: "sent"; id: number; target: Target }
  | { kind: "stored"; id: number }
  | { kind: "error"; id: number; at: Target }
  | { kind: "requeued"; id: number }
  | { kind: "discarded"; id: number };
export interface OutageState {
  t: number;
  nextSample: number;
  nextTry: number;
  failures: number;
  nextId: number;
  queue: Snapshot[];
  flight: Flight | null;
  backendUp: boolean;
  dbUp: boolean;
  events: OutageEvent[];
}

export function initialOutage(): OutageState {
  return { t: 0, nextSample: 0.3, nextTry: 0, failures: 0, nextId: 1, queue: [], flight: null, backendUp: true, dbUp: true, events: [] };
}

/** Advances the model by dt. Mutates and returns `s`; `s.events` holds only this step's events. */
export function stepOutage(s: OutageState, dt: number, random: () => number, timing: OutageTiming = SCALED): OutageState {
  s.events = [];
  s.t += dt;
  if (s.t >= s.nextSample) {
    s.nextSample += timing.sampleEvery;
    const id = s.nextId++;
    s.queue.push({ id, takenAt: s.t, seatedAt: null });
    s.events.push({ kind: "sampled", id });
    if (s.queue.length > CAPACITY) {
      const old = s.queue.shift()!;
      const inFlight = s.flight?.id === old.id;
      if (inFlight) s.flight!.dropped = true;
      s.events.push({ kind: "dropped", id: old.id, inFlight });
    }
  }
  for (const q of s.queue) if (q.seatedAt === null && s.t - q.takenAt >= timing.arrive) q.seatedAt = s.t;

  const head = s.queue[0];
  if (!s.flight && head && head.seatedAt !== null && s.t - head.seatedAt >= timing.minDwell && s.t >= s.nextTry) {
    const target: Target = !s.backendUp ? "tunnel" : !s.dbUp ? "backend" : "db";
    const ok = s.backendUp && s.dbUp;
    const duration = timing.trip[target] * (ok && s.queue.length > 1 ? timing.drainFactor : 1);
    s.flight = { id: head.id, target, ok, phase: "out", startedAt: s.t, duration, dropped: false };
    s.events.push({ kind: "sent", id: head.id, target });
  }

  const f = s.flight;
  if (f && s.t - f.startedAt >= f.duration) {
    // Decided on arrival, not when sent: a request still on its way when the backend or database goes
    // down fails, as it would for the agent.
    if (f.phase === "out" && f.ok && s.backendUp && s.dbUp) {
      if (s.queue[0]?.id === f.id) s.queue.shift(); // pusher.ts: shift only if it's still the head
      s.events.push({ kind: "stored", id: f.id });
      s.failures = 0;
      s.nextTry = s.t;
      s.flight = null;
    } else if (f.phase === "out") {
      s.events.push({ kind: "error", id: f.id, at: f.target });
      s.flight = { ...f, phase: "back", startedAt: s.t };
    } else {
      s.nextTry = s.t + backoffDelay(s.failures, timing.backoffBase, timing.backoffMax, random);
      s.failures += 1;
      s.flight = null;
      if (f.dropped) s.events.push({ kind: "discarded", id: f.id });
      else {
        s.queue[0].seatedAt = s.t;
        s.events.push({ kind: "requeued", id: f.id });
      }
    }
  }
  return s;
}

// Bringing something back doesn't wake the agent: like pusher.ts, it finds out at its next scheduled retry.
export function setBackendUp(s: OutageState, up: boolean): void {
  s.backendUp = up;
}
export function setDbUp(s: OutageState, up: boolean): void {
  s.dbUp = up;
}
