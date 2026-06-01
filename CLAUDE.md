# CLAUDE.md

> Guidance for Claude Code (and humans) working in this repository.

## What this is

`lore` is a local-first CLI that answers one question better than anything else:
**"Why is this code like this?"**

Point it at a line, file, or symbol and it reconstructs the *intent* behind it — not
just the diff that changed it. It mines git history, commit messages, merged PRs,
linked issues, and review threads, then synthesizes them into a clear, sourced
narrative. Think `git blame`, but it tells you the *story* instead of a name and a hash.

The pitch in one line: **institutional memory that survives the people who leave.**

```
$ lore why src/auth/session.ts:88
```

## The bet (read this before touching anything)

Dozens of tools can dump git history into an LLM. None of them are worth a star. The
entire value of `lore` is the **quality of the synthesis** — whether the answer reads
like a thoughtful senior engineer who was in the room, or like a robot summarizing a
changelog.

So: **the output is the product.** When unsure whether to spend effort on a feature or
on the prose quality of an explanation, choose the prose. Every time.

A good `lore` answer:
- Leads with the *decision and its reason*, not a chronological timeline.
- Cites its evidence (commit SHA, PR #, issue link) so the user can verify it and
  distrust it appropriately.
- Says "the history is silent on this" when it is, instead of inventing a plausible
  motive. **Confabulation is the cardinal sin of this project.**
- Distinguishes "what the commit message claims" from "what the code actually does."
- Is short. A paragraph that earns trust beats a page that exhausts it.

## Non-goals (do not build these)

- **Not a chatbot.** No conversational memory, no "ask me anything." One question, one
  great answer.
- **Not a code generator or refactorer.** `lore` is strictly read-only on your code.
- **Not a hosted service.** Local-first is a feature, not a phase. Git history never
  leaves the machine unless the user explicitly points at a hosted model.
- **Not an "AI" branding play.** The word "AI" should appear ~zero times in the UI. The
  model is plumbing, not the headline.

## Architecture

Three stages, cleanly separated so each is independently testable:

1. **Collect** (`src/collect/`) — pull raw evidence: git log/blame, PR + issue metadata
   via forge adapters (GitHub, GitLab). No interpretation. Deterministic, cacheable,
   offline after first sync.
2. **Assemble** (`src/assemble/`) — turn raw evidence into a structured `Dossier` for the
   target: relevant commits, the PRs that introduced them, the discussion, ranked by
   relevance. Still no LLM. Most of the engineering quality lives here — garbage dossier,
   garbage answer.
3. **Narrate** (`src/narrate/`) — the only stage that touches a model. Takes a `Dossier`,
   produces a sourced narrative. Provider-pluggable (see stack).

Data flows one way: Collect → Assemble → Narrate. Never let narration logic leak upstream.

## Tech stack

- **TypeScript**, strict mode, no exceptions.
- **Ink** (React for CLIs) for the TUI — components and hooks in a terminal, lean into it.
- **simple-git** for git plumbing; raw `git` via child_process only when simple-git can't
  express it.
- **Narrator adapters**: Ollama (default, fully local), Anthropic, OpenAI-compatible. The
  interface is `Narrator` in `src/narrate/types.ts`. A user with Ollama installed should
  get a working tool with **zero API keys**.
- **Vitest** for tests. No heavy mocking frameworks — prefer real fixtures (small
  throwaway git repos generated in tests).

## Commands

```bash
pnpm install                       # we use pnpm; do not add npm/yarn lockfiles
pnpm dev -- why src/foo.ts:42      # run against this repo during development
pnpm build                         # tsup -> dist/
pnpm test                          # vitest run
pnpm lint                          # eslint + prettier check
pnpm typecheck                     # tsc --noEmit
```

Before opening a PR: `pnpm typecheck && pnpm lint && pnpm test` must all pass. CI enforces
it — don't make CI catch what you could have.

## Conventions

- **Conventional Commits.** We dogfood: our own history is the first thing skeptics will
  run `lore` on, so it had better tell a good story.
- Pure functions in Collect/Assemble. Side effects (fs, network, model calls) live at the
  edges and are injected, never imported deep.
- No `any`. If you reach for it, the type is trying to tell you something.
- User-facing strings live in one place (`src/strings.ts`) and read like a human wrote
  them. Error messages suggest the fix.
- Comments explain *why*, never *what*. (The tool that explains "why" should not need
  comments that explain "what.")

## Testing the thing that matters

Unit-test Collect and Assemble normally. For Narrate we can't assert exact model output,
so:
- Test **prompt assembly** and **dossier ranking** deterministically.
- Keep a small suite of **golden repos** (`test/fixtures/repos/`) with known histories and
  a human-written "ideal answer." Snapshots of narration are reviewed by a human on prompt
  changes — never auto-updated blindly.

## Gotchas

- `git log --follow` lies across some renames; Assemble compensates. Don't "simplify" it
  back.
- Shallow clones have no history — detect it and say so plainly rather than producing a
  confident, empty answer.
- Forge API rate limits are real; the Collect cache is not optional.

## When in doubt

Optimize for the moment a tired engineer types `lore why <thing>` at 2am and gets an
answer that makes them exhale. That feeling is the whole repo.
