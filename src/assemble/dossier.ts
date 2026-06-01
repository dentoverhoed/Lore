import type { Collected, Dossier, DossierCommit } from '../types.js';
import { computeEvidenceThin, rankCommits } from './rank.js';

/** Keep the prompt tight — the most relevant commits, not the whole log. */
const TOP_N = 8;

/**
 * Turn raw collected evidence into a ranked, capped Dossier. Pure: no I/O.
 * This is where most of the engineering quality lives — garbage dossier,
 * garbage answer.
 */
export function buildDossier(collected: Collected): Dossier {
  const ranked = rankCommits(collected.commits).slice(0, TOP_N);

  const commits: DossierCommit[] = ranked.map((c) => ({
    ...c,
    shortSha: c.sha.slice(0, 7),
  }));

  return {
    target: collected.target,
    commits,
    introducingSha: collected.introducingSha,
    lineContent: collected.lineContent,
    shallow: collected.shallow,
    evidenceThin: computeEvidenceThin(collected.commits),
  };
}
