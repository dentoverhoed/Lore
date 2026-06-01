# Hour-zero probe: `git log -L` (slice 1 load-bearing assumption)

Run against a throwaway repo containing a rename + a line that evolves
(introduce → guard → fallback) before building Collect. Findings drive the
Collect design.

## What we confirmed

1. **`-L` honors a custom `--format`.** Contrary to the worry that `-L` "largely
   ignores `--format`", this works and is cleanly parseable:

   ```
   git log -L <line>,<line>:<file> --format='@@COMMIT@@%H'
   ```

   emits, per commit (newest → oldest):

   ```
   @@COMMIT@@<40-char-sha>

   diff --git a/<path> b/<path>
   --- a/<path>
   +++ b/<path>
   @@ -L,N +L,N @@
   -<old line>
   +<new line>
   ```

   Parse: split on `@@COMMIT@@`; first token = sha; remainder = the line hunk.

2. **`-L` follows the rename.** The chain includes commits made when the file had
   a *different name*, and the hunk for those commits is emitted against the path
   *as it was at that commit* (`old.ts`, not `new.ts`). This is why a single `-L`
   call is the right hunk source — `git show <sha> -- <currentPath>` returns
   **empty** for pre-rename commits because the path filter misses them.

3. **Introducing commit = the last (bottom) entry of the chain** (oldest), not
   `git blame` (which gives the last modifier).

4. **Design correction this probe earned:** across a rename, the line-commit set is
   **not** a subset of `git log -- <currentFile>` (pre-rename commits live under the
   old path and never appear in the current file's log). So Collect must **union**
   the line-commit chain with the file log and **dedup by sha** — the "file log is
   the superset, just tag it" simplification only holds when there's no rename.

## Failure modes (→ friendly `strings.ts` messages, not raw git errors)

- Line no longer on HEAD / past EOF: `fatal: file <f> has only <n> lines`
  (most common real error).
- Bad / non-existent path: `fatal: There is no path <f> in the commit`.

## Resulting Collect plan

- `git log -L l,l:file --format='@@COMMIT@@%H'` → ordered `[{sha, hunk}]`
  (rename-followed). `introducingSha` = last. `touchedTargetLine` set = these shas.
- `git log --format=<null-separated fields> -- file` → metadata for file commits.
- Union by sha (covers pre-rename line commits absent from the file log); fetch
  metadata for any line-commit sha missing from the file log via `git show
  --no-patch`.
