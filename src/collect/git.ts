import { execFile } from 'node:child_process';
import path from 'node:path';

import { LoreError } from '../errors.js';
import { strings } from '../strings.js';
import type { Collected, RawCommit, Target } from '../types.js';

/**
 * A git invocation. Injected so tests can drive throwaway repos (or fakes)
 * without reaching for the global `git`. Side effects live at this edge only.
 */
export type GitRunner = (
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string; code: number }>;

/** Default runner: shell out to the real `git`. */
export const realGit: GitRunner = (args, cwd) =>
  new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? (err as { code: number }).code
            : err
              ? 1
              : 0;
        resolve({ stdout, stderr, code });
      },
    );
  });

// Field/record separators for parsing `git log --format` without choking on
// multi-line commit bodies. \x1f = unit separator, \x1e = record separator.
const FS = '\x1f';
const RS = '\x1e';
const LOG_FORMAT = `%H${FS}%an${FS}%aI${FS}%s${FS}%b${RS}`;
const COMMIT_MARKER = '@@COMMIT@@';

interface Meta {
  author: string;
  date: string;
  subject: string;
  body: string;
}

/** Translate a failed git call into a LoreError the user can act on. */
function explainGitFailure(stderr: string, target: Target): LoreError {
  if (/has only \d+ lines?/i.test(stderr)) {
    return new LoreError(strings.lineNotOnHead(target.file, target.line));
  }
  if (
    /no path .* in|exists on disk, but not in|does not have any commits yet/i.test(stderr)
  ) {
    return new LoreError(strings.fileNotFound(target.file));
  }
  return new LoreError(strings.gitFailed(stderr.trim() || 'unknown error'));
}

/** Repo root, or null if cwd is not inside a git repository. */
async function repoRoot(git: GitRunner, cwd: string): Promise<string | null> {
  const { stdout, code } = await git(['rev-parse', '--show-toplevel'], cwd);
  if (code !== 0) return null;
  return stdout.trim() || null;
}

async function isShallow(git: GitRunner, cwd: string): Promise<boolean> {
  const { stdout } = await git(['rev-parse', '--is-shallow-repository'], cwd);
  return stdout.trim() === 'true';
}

/** Current content of the target line at HEAD (best effort, trimmed of EOL). */
async function lineAtHead(
  git: GitRunner,
  cwd: string,
  rel: string,
  line: number,
): Promise<string> {
  // `HEAD:./<path>` resolves relative to cwd (a bare `HEAD:<path>` is root-relative).
  const { stdout, code } = await git(['show', `HEAD:./${rel}`], cwd);
  if (code !== 0) return '';
  const lines = stdout.split('\n');
  return (lines[line - 1] ?? '').replace(/\r$/, '');
}

/**
 * The `-L` chain: every commit that changed the target line, newest first,
 * each with its line-range hunk. Follows renames (the hunk's path is the path
 * as it was at that commit). This is the load-bearing primitive.
 */
async function lineChain(
  git: GitRunner,
  cwd: string,
  rel: string,
  target: Target,
): Promise<Array<{ sha: string; hunk: string }>> {
  const spec = `${target.line},${target.line}:${rel}`;
  const { stdout, stderr, code } = await git(
    ['log', `-L${spec}`, `--format=${COMMIT_MARKER}%H`],
    cwd,
  );
  if (code !== 0) throw explainGitFailure(stderr, target);

  return stdout
    .split(COMMIT_MARKER)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const nl = block.indexOf('\n');
      const sha = (nl === -1 ? block : block.slice(0, nl)).trim();
      const hunk = nl === -1 ? '' : block.slice(nl + 1).trim();
      return { sha, hunk };
    });
}

/** Metadata for every commit in the current file's history (the broad set). */
async function fileLog(
  git: GitRunner,
  cwd: string,
  rel: string,
): Promise<Map<string, Meta>> {
  const { stdout } = await git(['log', `--format=${LOG_FORMAT}`, '--', rel], cwd);
  const map = new Map<string, Meta>();
  for (const record of stdout.split(RS)) {
    const trimmed = record.trim();
    if (!trimmed) continue;
    const [sha, author, date, subject, ...bodyParts] = trimmed.split(FS);
    if (!sha) continue;
    map.set(sha, {
      author: author ?? '',
      date: date ?? '',
      subject: subject ?? '',
      body: (bodyParts.join(FS) ?? '').trim(),
    });
  }
  return map;
}

/** Fetch metadata for a single sha (pre-rename line commits absent from fileLog). */
async function showMeta(git: GitRunner, cwd: string, sha: string): Promise<Meta | null> {
  const { stdout, code } = await git(
    ['show', '--no-patch', `--format=${LOG_FORMAT}`, sha],
    cwd,
  );
  if (code !== 0) return null;
  const [shaOut, author, date, subject, ...bodyParts] = stdout.split(RS)[0]!.split(FS);
  if (!shaOut) return null;
  return {
    author: author ?? '',
    date: date ?? '',
    subject: subject ?? '',
    body: (bodyParts.join(FS) ?? '').trim(),
  };
}

/**
 * Collect raw evidence for a target. No interpretation — that is Assemble's job.
 *
 * Union of the line chain and the file log (deduped by sha): across a rename the
 * line chain contains commits that the current file's log never sees, so neither
 * set is a strict superset of the other.
 */
export async function collect(
  target: Target,
  cwd: string,
  git: GitRunner = realGit,
): Promise<Collected> {
  const root = await repoRoot(git, cwd);
  if (root === null) {
    throw new LoreError(strings.notARepo(cwd));
  }

  // Run every git command from `cwd` and pass the path as given (git resolves it
  // relative to cwd). This deliberately avoids relativizing against git's reported
  // root: on Windows `cwd` can be an 8.3 short path ("DIRK~1.DEP") while git reports
  // the long form, and path.relative between the two escapes the repo.
  let rel = target.file;
  if (path.isAbsolute(rel)) rel = path.relative(cwd, rel);
  rel = rel.split(path.sep).join('/');

  const shallow = await isShallow(git, cwd);
  const chain = await lineChain(git, cwd, rel, target);
  const lineShas = new Set(chain.map((c) => c.sha));
  const hunks = new Map(chain.map((c) => [c.sha, c.hunk]));
  const introducingSha = chain.length > 0 ? chain[chain.length - 1]!.sha : null;

  const fileMeta = await fileLog(git, cwd, rel);

  // Union of shas: file-log order first (recent), then any line-only shas.
  const shas = [...fileMeta.keys()];
  for (const sha of lineShas) if (!fileMeta.has(sha)) shas.push(sha);

  const commits: RawCommit[] = [];
  for (const sha of shas) {
    const meta = fileMeta.get(sha) ?? (await showMeta(git, cwd, sha));
    if (!meta) continue;
    const touchedTargetLine = lineShas.has(sha);
    commits.push({
      sha,
      author: meta.author,
      date: meta.date,
      subject: meta.subject,
      body: meta.body,
      touchedTargetLine,
      ...(touchedTargetLine ? { hunk: hunks.get(sha) ?? '' } : {}),
    });
  }

  const lineContent = await lineAtHead(git, cwd, rel, target.line);

  return { target, commits, introducingSha, lineContent, shallow };
}
