/**
 * Shared types across the three stages. Data flows one way:
 * Collect -> Assemble -> Narrate. These types are the contracts between them.
 */

/** What the user pointed `lore` at. Line is required in slice 1. */
export interface Target {
  /** Path as given on the command line (used in messages). */
  file: string;
  /** 1-based line number. */
  line: number;
}

/** Raw evidence for one commit. Collect emits these — no interpretation. */
export interface RawCommit {
  sha: string;
  author: string;
  /** ISO-8601 author date. */
  date: string;
  subject: string;
  body: string;
  /** True if this commit changed the exact target line (in the `-L` chain). */
  touchedTargetLine: boolean;
  /** The line-range diff hunk, present only for line-touching commits. */
  hunk?: string;
}

/** Raw output of the Collect stage. */
export interface Collected {
  target: Target;
  commits: RawCommit[];
  /** Oldest commit in the `-L` chain — the one that introduced the line. */
  introducingSha: string | null;
  /** Current content of the target line at HEAD. */
  lineContent: string;
  /** History is truncated (shallow clone) — answers may be incomplete. */
  shallow: boolean;
}

/** Forge metadata slots — unpopulated in slice 1, here so adapters slot in later. */
export interface PullRequest {
  number: number;
  title: string;
  url: string;
}
export interface Issue {
  number: number;
  title: string;
  url: string;
}

/** A commit as it appears in the assembled Dossier (ranked). */
export interface DossierCommit extends RawCommit {
  /** Abbreviated sha for display / citation. */
  shortSha: string;
  pr?: PullRequest;
  issues?: Issue[];
}

/** The structured evidence handed to Narrate. Most quality lives in building this. */
export interface Dossier {
  target: Target;
  /** Ranked: line-touching commits first, recency as tiebreak. Capped to top N. */
  commits: DossierCommit[];
  introducingSha: string | null;
  lineContent: string;
  shallow: boolean;
  /**
   * Evidence is too thin or too noisy to support a confident "why".
   * Routes Narrate toward "the history is silent" instead of confabulation.
   */
  evidenceThin: boolean;
}
