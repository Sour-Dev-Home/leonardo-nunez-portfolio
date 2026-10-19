// One lane's path, drawn two ways. Desktop: two rows, the top left to right and the bottom right to left, joined on
// the right, well clear of the labels. Phones: one column, labels to the right.
import type { StationId } from "../model/path";

export interface Pt {
  x: number;
  y: number;
}
export interface LaneLayout {
  w: number;
  h: number;
  labels: "below" | "right";
  at: Record<StationId, Pt>;
  track: string;
}

export const LANES: { desktop: LaneLayout; phone: LaneLayout } = {
  desktop: {
    w: 764,
    h: 300,
    labels: "below",
    at: {
      issue: { x: 80, y: 70 },
      contract: { x: 250, y: 70 },
      lane: { x: 420, y: 70 },
      pr: { x: 590, y: 70 },
      reviewers: { x: 590, y: 215 },
      gate: { x: 420, y: 215 },
      queue: { x: 250, y: 215 },
      main: { x: 80, y: 215 },
    },
    track: "M80 70 H732 Q740 70 740 78 V207 Q740 215 732 215 H80",
  },
  phone: {
    w: 340,
    h: 700,
    labels: "right",
    at: {
      issue: { x: 60, y: 50 },
      contract: { x: 60, y: 136 },
      lane: { x: 60, y: 222 },
      pr: { x: 60, y: 308 },
      reviewers: { x: 60, y: 394 },
      gate: { x: 60, y: 480 },
      queue: { x: 60, y: 566 },
      main: { x: 60, y: 652 },
    },
    track: "M60 50 V652",
  },
};
