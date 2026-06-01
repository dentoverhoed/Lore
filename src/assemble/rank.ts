import type { RawCommit } from '../types.js';

/**
 * Words that, alone, carry no "why". A message made only of these (with no body)
 * is noise the model would be tempted to confabulate around.
 *
 * Slice-1 limitation: this list is English-centric and brittle — a Dutch team's
 * "oplossing" / "aanpassing" slips through. Acceptable for now; revisit when
 * evidence quality scoring gets real.
 */
const NOISE_WORDS = new Set([
  'fix',
  'fixes',
  'fixed',
  'wip',
  'update',
  'updates',
  'updated',
  'minor',
  'tweak',
  'tweaks',
  'cleanup',
  'misc',
  'stuff',
  'changes',
  'change',
  'tmp',
  'temp',
  'test',
  'init',
  'initial',
  'first',
  'commit',
]);

/** A commit message carries little signal: only noise words and an empty body. */
export function isNoisyMessage(subject: string, body: string): boolean {
  if (body.trim().length > 0) return false;
  const tokens = subject
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = tokens.filter((t) => t.length > 2 && !NOISE_WORDS.has(t));
  return meaningful.length === 0;
}

/**
 * Rank: commits that touched the exact line rank above file-only commits;
 * recency (ISO date string, lexicographically sortable) breaks ties.
 */
export function rankCommits<T extends RawCommit>(commits: readonly T[]): T[] {
  return [...commits].sort((a, b) => {
    if (a.touchedTargetLine !== b.touchedTargetLine) {
      return a.touchedTargetLine ? -1 : 1;
    }
    return b.date.localeCompare(a.date);
  });
}

/**
 * Evidence is thin when nothing explains the line, or what does explain it is
 * pure noise. Either way Narrate should admit silence rather than invent a motive.
 */
export function computeEvidenceThin(commits: readonly RawCommit[]): boolean {
  const signal = commits.filter((c) => c.touchedTargetLine);
  if (signal.length === 0) return true;
  return signal.every((c) => isNoisyMessage(c.subject, c.body));
}
