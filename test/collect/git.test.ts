import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collect } from '../../src/collect/git.js';
import { LoreError } from '../../src/errors.js';
import { buildBiographyRepo, TempRepo } from '../fixtures/repo.js';

describe('collect (real git, biography repo)', () => {
  let repo: TempRepo;
  beforeEach(() => {
    repo = buildBiographyRepo();
  });
  afterEach(() => {
    repo.cleanup();
  });

  it('tags the three line-touching commits and follows the rename', async () => {
    const result = await collect({ file: 'new.ts', line: 2 }, repo.dir);
    const touched = result.commits.filter((c) => c.touchedTargetLine);
    const subjects = touched.map((c) => c.subject).sort();
    expect(subjects).toEqual([
      'feat: add fallback when guard returns null',
      'feat: introduce target', // pre-rename, lived under old.ts — rename followed
      'fix: guard against race in X', // pre-rename
    ]);
  });

  it('does not tag the commit that touched a different line', async () => {
    const result = await collect({ file: 'new.ts', line: 2 }, repo.dir);
    const other = result.commits.find((c) => c.subject === 'chore: touch other line');
    expect(other).toBeDefined();
    expect(other?.touchedTargetLine).toBe(false);
  });

  it('introducing commit is the oldest in the chain, not the last modifier', async () => {
    const result = await collect({ file: 'new.ts', line: 2 }, repo.dir);
    const introducing = result.commits.find((c) => c.sha === result.introducingSha);
    expect(introducing?.subject).toBe('feat: introduce target');
  });

  it('captures the current line content and per-commit hunks', async () => {
    const result = await collect({ file: 'new.ts', line: 2 }, repo.dir);
    expect(result.lineContent).toBe('TARGET = guard(x) ?? fallback');
    const fallback = result.commits.find((c) =>
      c.subject.startsWith('feat: add fallback'),
    );
    expect(fallback?.hunk).toContain('?? fallback');
  });

  it('is not flagged shallow for a normal repo', async () => {
    const result = await collect({ file: 'new.ts', line: 2 }, repo.dir);
    expect(result.shallow).toBe(false);
  });

  it('errors clearly when the line is no longer on HEAD', async () => {
    await expect(collect({ file: 'new.ts', line: 999 }, repo.dir)).rejects.toBeInstanceOf(
      LoreError,
    );
  });

  it('errors clearly when the path is unknown to git', async () => {
    await expect(collect({ file: 'nope.ts', line: 1 }, repo.dir)).rejects.toBeInstanceOf(
      LoreError,
    );
  });

  it('errors clearly outside a git repository', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const dir = mkdtempSync(path.join(tmpdir(), 'lore-norepo-'));
    await expect(collect({ file: 'x.ts', line: 1 }, dir)).rejects.toBeInstanceOf(
      LoreError,
    );
  });
});
