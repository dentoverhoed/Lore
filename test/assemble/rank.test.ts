import { describe, expect, it } from 'vitest';

import {
  computeEvidenceThin,
  isNoisyMessage,
  rankCommits,
} from '../../src/assemble/rank.js';
import type { RawCommit } from '../../src/types.js';

function commit(over: Partial<RawCommit>): RawCommit {
  return {
    sha: 'x',
    author: 'a',
    date: '2020-01-01',
    subject: 's',
    body: '',
    touchedTargetLine: false,
    ...over,
  };
}

describe('rankCommits', () => {
  it('puts line-touching commits first, then sorts by recency', () => {
    const commits = [
      commit({ sha: 'old-file', date: '2023-01-01', touchedTargetLine: false }),
      commit({ sha: 'old-line', date: '2019-01-01', touchedTargetLine: true }),
      commit({ sha: 'new-line', date: '2022-01-01', touchedTargetLine: true }),
    ];
    expect(rankCommits(commits).map((c) => c.sha)).toEqual([
      'new-line',
      'old-line',
      'old-file',
    ]);
  });
});

describe('isNoisyMessage', () => {
  it('flags a bare noise word with no body', () => {
    expect(isNoisyMessage('fix', '')).toBe(true);
    expect(isNoisyMessage('wip', '')).toBe(true);
    expect(isNoisyMessage('update', '')).toBe(true);
  });

  it('does not flag a message with real detail', () => {
    expect(isNoisyMessage('fix: guard against race in X', '')).toBe(false);
  });

  it('does not flag a noise subject when the body carries the why', () => {
    expect(isNoisyMessage('fix', 'The upstream API returns null on cold start.')).toBe(
      false,
    );
  });
});

describe('computeEvidenceThin', () => {
  it('is thin when nothing touched the line', () => {
    expect(computeEvidenceThin([commit({ touchedTargetLine: false })])).toBe(true);
  });

  it('is thin when every line-touching commit is noise', () => {
    expect(
      computeEvidenceThin([
        commit({ touchedTargetLine: true, subject: 'fix' }),
        commit({ touchedTargetLine: true, subject: 'wip' }),
      ]),
    ).toBe(true);
  });

  it('is thin for the classic noise trap (init / fix / wip)', () => {
    expect(
      computeEvidenceThin([
        commit({ touchedTargetLine: true, subject: 'init' }),
        commit({ touchedTargetLine: true, subject: 'fix' }),
        commit({ touchedTargetLine: true, subject: 'wip' }),
      ]),
    ).toBe(true);
  });

  it('is not thin when a line-touching commit explains itself', () => {
    expect(
      computeEvidenceThin([
        commit({ touchedTargetLine: true, subject: 'fix: guard against race in X' }),
      ]),
    ).toBe(false);
  });
});
