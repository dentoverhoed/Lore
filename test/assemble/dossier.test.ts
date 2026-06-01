import { describe, expect, it } from 'vitest';

import { buildDossier } from '../../src/assemble/dossier.js';
import type { Collected, RawCommit } from '../../src/types.js';

function rawCommit(i: number, touched: boolean): RawCommit {
  return {
    sha: `sha${i.toString().padStart(40, '0')}`,
    author: 'a',
    date: `2020-01-${(i + 1).toString().padStart(2, '0')}`,
    subject: `commit ${i}`,
    body: 'because reasons',
    touchedTargetLine: touched,
  };
}

function collected(commits: RawCommit[]): Collected {
  return {
    target: { file: 'f.ts', line: 1 },
    commits,
    introducingSha: commits.at(-1)?.sha ?? null,
    lineContent: 'x',
    shallow: false,
  };
}

describe('buildDossier', () => {
  it('caps to the top 8 ranked commits', () => {
    const many = Array.from({ length: 20 }, (_, i) => rawCommit(i, true));
    expect(buildDossier(collected(many)).commits).toHaveLength(8);
  });

  it('adds a 7-char shortSha', () => {
    const d = buildDossier(collected([rawCommit(1, true)]));
    expect(d.commits[0]?.shortSha).toHaveLength(7);
  });

  it('flags evidenceThin when nothing touched the line', () => {
    const d = buildDossier(collected([rawCommit(1, false)]));
    expect(d.evidenceThin).toBe(true);
  });
});
