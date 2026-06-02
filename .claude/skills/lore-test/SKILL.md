---
name: lore-test
description: >-
  Run the lore CLI to try a "why <file>:<line>" explanation, or run lore's test
  suite. Use when the user wants to test lore, try it on a line, see a narrative,
  point it at another git repo, or verify the build/tests pass. Trigger phrases:
  "test lore", "try lore", "lore why ...", "run lore on <file>:<line>",
  "run the tests".
---

# Testing lore

lore answers "why is this code like this?" from git history. This skill drives it
for quick manual testing. lore reads the git history of the **current working
directory**, so run it from inside the repo you want to ask about.

## Picking the model / narrator

lore resolves a narrator automatically: a running local Ollama wins (zero keys),
else Anthropic if `ANTHROPIC_API_KEY` is set.

- If Ollama is used, check which model tag exists: `ollama list`. The code default
  is `llama3.1`; if only `llama3.1:8b` is pulled, set `LORE_OLLAMA_MODEL=llama3.1:8b`
  (PowerShell: `$env:LORE_OLLAMA_MODEL = "llama3.1:8b"`).
- If neither Ollama nor a key is available, tell the user and stop — do not invent
  output.

## Run a "why" query

Prefer the built binary (no pnpm needed). Build first only if `dist/cli.js` is missing.

PowerShell, from the lore repo root:

```powershell
$env:LORE_OLLAMA_MODEL = "llama3.1:8b"   # only if the :8b tag is what's pulled
node dist/cli.js why <file>:<line>
```

If `dist/cli.js` does not exist, build it once with `& ".\node_modules\.bin\tsup.CMD"`,
or run from source instead: `& ".\node_modules\.bin\tsx.CMD" src/cli.ts why <file>:<line>`.

The user may pass the target as the skill argument (e.g. `src/assemble/rank.ts:30`).
If they don't, suggest a target that has real history, such as
`src/narrate/prompt.ts:14` or `src/collect/git.ts:200`.

### Pointing lore at another project

Run `node <abs-path-to>/lore/dist/cli.js why <file>:<line>` from inside that other
repo (lore uses `process.cwd()` for git).

## Run the test suite

```powershell
& ".\node_modules\.bin\vitest.CMD" run      # 34 tests over 6 files
& ".\node_modules\.bin\tsc.CMD" --noEmit    # typecheck
```

## What a good result looks like

- Leads with the decision and its reason, not a timeline.
- Cites real short SHAs (cross-check against `git log --oneline`).
- On a line whose history is only `wip`/`fix`/`init`, it says the history is silent
  rather than inventing a motive — that refusal is the point, not a failure.

## Notes

- `pnpm` scripts are flaky in this environment (corepack-only); use the direct
  `node` / `.\node_modules\.bin\*` invocations above.
- This is read-only: lore never writes to the target repo.
