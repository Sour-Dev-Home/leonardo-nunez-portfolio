// Figure 2's states, step by step, from the runbook in Sour-Dev-Home/satisfactory-dash:
// docs-vault/wiki/runbooks/aws.md, "Cutover" (steps 1 to 5 and each rollback).
export const STEP_NAMES = ["Freeze", "Back up", "Restore", "Start", "Switch"] as const;
export const LAST_STEP = 5;
export type Mode = "live" | "idle";
export interface CutoverView {
  agent: Mode;
  agentNote: string;
  pcBackend: Mode;
  pcBackendNote: string;
  pcDb: Mode;
  pcDbNote: string;
  b2Note: string;
  b2HasDump: boolean;
  rds: Mode;
  rdsNote: string;
  countsMatch: boolean;
  awsBackend: Mode;
  awsBackendNote: string;
  route: "pc" | "aws";
  sending: boolean;
}

export function viewAt(step: number): CutoverView {
  const s = Math.max(0, Math.min(LAST_STEP, Math.floor(step)));
  const frozen = s >= 1 && s < 5;
  return {
    agent: frozen ? "idle" : "live",
    agentNote: frozen ? "paused" : "sending",
    pcBackend: s >= 1 ? "idle" : "live",
    pcBackendNote: s >= 1 ? "stopped" : "serving",
    pcDb: s >= 5 ? "idle" : "live",
    pcDbNote: s >= 5 ? "stopped · kept two weeks" : s >= 1 ? "frozen" : "source of truth",
    b2Note: s >= 2 ? "final dump + row counts" : "nightly backups",
    b2HasDump: s >= 2,
    rds: s >= 3 ? "live" : "idle",
    rdsNote: s >= 3 ? "RDS · counts match" : "RDS · empty",
    countsMatch: s >= 3,
    awsBackend: s >= 4 ? "live" : "idle",
    awsBackendNote: s >= 4 ? "Fargate · ready" : "Fargate · scaled to 0",
    route: s >= 5 ? "aws" : "pc",
    sending: !frozen,
  };
}

export const COPY = [
  { caption: "Before: the PC serves everything. AWS is built and waiting, scaled to 0, with an empty database.", rollback: "" },
  { caption: "Freeze. Stop the agent's task and the PC backend, so nothing writes.", rollback: "Start the PC backend and the agent again; nothing has moved yet." },
  { caption: "Final backup. Back up the PC database by hand to B2 and note every table's row count.", rollback: "Re-enable the nightly backup, then undo the freeze." },
  { caption: "Restore into RDS, migrate, and compare the row counts. Any mismatch stops the cutover.", rollback: "The PC data is untouched: undo the backup step. RDS is reset before another try." },
  { caption: "Start on AWS. Scale to one task; the readiness check answers 200 on a staging hostname.", rollback: "Scale to 0, then undo the backup step." },
  {
    caption: "Switch the route. api.satis-manager.com moves to the AWS tunnel; the agent starts again and its snapshots arrive.",
    rollback: "Put the hostname back on the PC tunnel, scale AWS to 0, then undo the backup step, all within the window.",
  },
] as const;
