import { describe, expect, it } from 'vitest';

import { buildPrompt } from '../../src/narrate/prompt.js';
import type { Dossier } from '../../src/types.js';

function dossier(over: Partial<Dossier> = {}): Dossier {
  return {
    target: { file: 'src/foo.ts', line: 2 },
    lineContent: 'TARGET = guard(x) ?? fallback',
    introducingSha: 'aaaaaaa',
    shallow: false,
    evidenceThin: false,
    commits: [
      {
        sha: 'd5482c4ce9ab',
        shortSha: 'd5482c4',
        author: 'Dev',
        date: '2022-09-01',
        subject: 'feat: add fallback when guard returns null',
        body: 'Cold starts returned null and crashed callers.',
        touchedTargetLine: true,
        hunk: '@@ -2,1 +2,1 @@\n-TARGET = guard(x)\n+TARGET = guard(x) ?? fallback',
      },
    ],
    ...over,
  };
}

describe('buildPrompt', () => {
  it('is deterministic: same dossier in, same prompt out', () => {
    expect(buildPrompt(dossier())).toEqual(buildPrompt(dossier()));
  });

  it('includes the line content, hunk, and short SHA for citation', () => {
    const { user } = buildPrompt(dossier());
    expect(user).toContain('TARGET = guard(x) ?? fallback');
    expect(user).toContain('+TARGET = guard(x) ?? fallback');
    expect(user).toContain('d5482c4');
    expect(user).toContain('Cold starts returned null');
  });

  it('instructs against confabulation in the system prompt', () => {
    const { system } = buildPrompt(dossier());
    expect(system.toLowerCase()).toContain('never invent');
    expect(system.toLowerCase()).toContain('history is silent');
  });

  it('forbids fabricating URLs / PR / issue links', () => {
    expect(buildPrompt(dossier()).system.toLowerCase()).toContain('never fabricate');
  });

  it('adds a thin-evidence note when flagged', () => {
    expect(buildPrompt(dossier({ evidenceThin: true })).user).toContain(
      'do not manufacture a reason',
    );
    expect(buildPrompt(dossier({ evidenceThin: false })).user).not.toContain(
      'do not manufacture a reason',
    );
  });

  it('adds a shallow-clone warning when flagged', () => {
    expect(buildPrompt(dossier({ shallow: true })).user).toContain('shallow clone');
  });
});
