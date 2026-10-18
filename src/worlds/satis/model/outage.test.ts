import { describe, it, expect } from "vitest";
import { CAPACITY, SCALED, initialOutage, setBackendUp, setDbUp, stepOutage, type OutageEvent, type OutageState } from "./outage";
import { seeded } from "./random";

function run(s: OutageState, seconds: number, random = seeded(1)): OutageEvent[] {
  const all: OutageEvent[] = [];
  for (let t = 0; t < seconds; t += 0.02) all.push(...stepOutage(s, 0.02, random).events);
  return all;
}
const kinds = (es: OutageEvent[], k: OutageEvent["kind"]) => es.filter((e) => e.kind === k);
/** Runs until nothing is in flight, so a failure set next applies to requests sent after it. */
function settle(s: OutageState) {
  while (s.flight) stepOutage(s, 0.02, seeded(1));
}

describe("outage model (agent/src/queue.ts, pusher.ts, backoff.ts)", () => {
  it("with everything up, every snapshot is stored and the queue stays short", () => {
    const s = initialOutage();
    const es = run(s, 30);
    expect(kinds(es, "stored").length).toBeGreaterThanOrEqual(kinds(es, "sampled").length - 2);
    expect(s.queue.length).toBeLessThanOrEqual(2);
  });

  it("every snapshot rests in the queue at least minDwell before it is sent", () => {
    const s = initialOutage();
    const seatedAt = new Map<number, number>();
    for (let i = 0; i < 1500; i++) {
      stepOutage(s, 0.02, seeded(i));
      for (const e of s.events) if (e.kind === "sent") expect(s.t - seatedAt.get(e.id)!).toBeGreaterThanOrEqual(SCALED.minDwell - 1e-9);
      for (const q of s.queue) if (q.seatedAt !== null && !seatedAt.has(q.id)) seatedAt.set(q.id, q.seatedAt);
    }
  });

  it("backend down: the error comes back from the tunnel and the snapshot stays at the head", () => {
    const s = initialOutage(); run(s, 3); settle(s); setBackendUp(s, false);
    const es = run(s, 6);
    expect(kinds(es, "error").length).toBeGreaterThan(0);
    expect(kinds(es, "error").every((e) => e.kind === "error" && e.at === "tunnel")).toBe(true);
    expect(kinds(es, "requeued").length).toBeGreaterThan(0);
    expect(kinds(es, "stored")).toEqual([]);
  });

  it("database down: the error comes back from the backend", () => {
    const s = initialOutage(); run(s, 3); settle(s); setDbUp(s, false);
    const es = run(s, 6);
    expect(kinds(es, "error").length).toBeGreaterThan(0);
    expect(kinds(es, "error").every((e) => e.kind === "error" && e.at === "backend")).toBe(true);
  });

  it("each retry waits longer than the last (until the cap), and success resets the waits", () => {
    const s = initialOutage(); run(s, 2); setBackendUp(s, false);
    const sentAt: number[] = [];
    for (let i = 0; i < 2500; i++) { stepOutage(s, 0.02, () => 0); if (s.events.some((e) => e.kind === "sent")) sentAt.push(s.t); }
    const gaps = sentAt.slice(1).map((t, i) => t - sentAt[i]);
    for (let i = 1; i < Math.min(gaps.length, 4); i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    // The agent learns the backend is back at its next retry, at most backoffMax away, plus one trip.
    setBackendUp(s, true); run(s, SCALED.backoffMax + 2);
    expect(s.failures).toBe(0);
  });

  it("a full queue drops the OLDEST, never the newest, and never holds more than its capacity", () => {
    const s = initialOutage(); setBackendUp(s, false);
    const es = run(s, 40);
    const dropped = kinds(es, "dropped").map((e) => e.id);
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped).toEqual([...dropped].sort((a, b) => a - b)); // oldest first
    expect(s.queue.length).toBeLessThanOrEqual(CAPACITY);
    const newest = Math.max(...kinds(es, "sampled").map((e) => e.id));
    expect(dropped).not.toContain(newest);
  });

  it("the head being sent keeps its place; if it's dropped in flight it is discarded when its error returns", () => {
    const s = initialOutage(); setBackendUp(s, false);
    const es = run(s, 60, () => 0.99); // long waits: the queue fills while one is away
    const inFlightDrops = kinds(es, "dropped").filter((e) => e.kind === "dropped" && e.inFlight).map((e) => e.id);
    expect(inFlightDrops.length).toBeGreaterThan(0);
    for (const id of inFlightDrops) expect(es.some((e) => e.kind === "discarded" && e.id === id)).toBe(true);
  });

  it("a request still on its way when the backend goes down fails instead of being stored", () => {
    const s = initialOutage();
    while (!s.flight) stepOutage(s, 0.02, seeded(1));
    const id = s.flight!.id;
    setBackendUp(s, false);
    const es = run(s, 3);
    expect(es.some((e) => e.kind === "stored" && e.id === id)).toBe(false);
    expect(es.some((e) => e.kind === "error" && e.id === id)).toBe(true);
  });

  it("after recovery the backlog drains oldest first", () => {
    const s = initialOutage(); setBackendUp(s, false); run(s, 25);
    const waiting = s.queue.map((q) => q.id);
    setBackendUp(s, true);
    const stored = kinds(run(s, 25), "stored").map((e) => e.id);
    expect(stored.slice(0, waiting.length)).toEqual(waiting);
    expect(s.queue.length).toBeLessThanOrEqual(2);
  });

  it("stays consistent under a storm of random toggles (Review Focus 2)", () => {
    const s = initialOutage(); const r = seeded(42);
    for (let i = 0; i < 20000; i++) {
      if (r() < 0.02) setBackendUp(s, !s.backendUp);
      if (r() < 0.02) setDbUp(s, !s.dbUp);
      stepOutage(s, 0.02, r);
      expect(s.queue.length).toBeLessThanOrEqual(CAPACITY);
      if (s.flight && !s.flight.dropped) expect(s.queue[0]?.id).toBe(s.flight.id);
      expect(new Set(s.queue.map((q) => q.id)).size).toBe(s.queue.length);
    }
  });
});
