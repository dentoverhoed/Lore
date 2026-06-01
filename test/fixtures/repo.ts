import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * A throwaway git repo for tests. Commit dates are pinned so the recency
 * tiebreak is deterministic and ranking tests never flake.
 */
export class TempRepo {
  readonly dir: string;

  constructor() {
    this.dir = mkdtempSync(path.join(tmpdir(), 'lore-test-'));
    this.git(['init', '-q', '-b', 'main']);
    this.git(['config', 'user.email', 'test@lore.dev']);
    this.git(['config', 'user.name', 'Lore Test']);
    this.git(['config', 'commit.gpgsign', 'false']);
    this.git(['config', 'core.autocrlf', 'false']);
  }

  git(args: string[], extraEnv: NodeJS.ProcessEnv = {}): string {
    return execFileSync('git', args, {
      cwd: this.dir,
      encoding: 'utf8',
      env: { ...process.env, ...extraEnv },
    });
  }

  write(file: string, content: string): void {
    writeFileSync(path.join(this.dir, file), content);
  }

  /** Stage everything and commit at a pinned ISO date (YYYY-MM-DD). */
  commit(message: string, isoDate: string): void {
    const date = `${isoDate}T00:00:00`;
    this.git(['add', '-A']);
    this.git(['commit', '-q', '-m', message], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
  }

  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/**
 * The canonical biography: a line born plain (2019), turned into a guard (2020),
 * the file renamed (2021), a fallback added (2022), and an unrelated line touched
 * (2023). Target line 2 of new.ts. Mirrors the hour-zero probe.
 */
export function buildBiographyRepo(): TempRepo {
  const repo = new TempRepo();
  repo.write('old.ts', 'line1\nORIG_TARGET = 1\nline3\n');
  repo.commit('feat: introduce target', '2019-01-01');

  repo.write('old.ts', 'line1\nTARGET = guard(x)\nline3\n');
  repo.commit('fix: guard against race in X', '2020-06-01');

  repo.git(['mv', 'old.ts', 'new.ts']);
  repo.commit('refactor: rename old.ts to new.ts', '2021-03-01');

  repo.write('new.ts', 'line1\nTARGET = guard(x) ?? fallback\nline3\n');
  repo.commit('feat: add fallback when guard returns null', '2022-09-01');

  repo.write('new.ts', 'line1\nTARGET = guard(x) ?? fallback\nlineX\n');
  repo.commit('chore: touch other line', '2023-01-01');
  return repo;
}
