# NexBridge

> **Why is this code like this?** — institutional memory that survives the people who leave.

NexBridge is a local-first CLI that reconstructs the *intent* behind a line of code. Point it
at a line and it mines your git history — commit messages, the diffs that actually changed the
line, the way the line evolved across renames — and synthesizes a short, **sourced** answer.

Think `git blame`, but instead of a name and a hash it tells you the *story*.

```
$ lore why src/auth/session.ts:88

The 1100ms timeout exists because the upstream SSO provider intermittently
took >1s to return under load, and the previous 500ms value 504'd the login
page for ~3% of users (a3f9c21). It was bumped deliberately, not by accident,
and the comment was never updated to say so.

Sources
  a3f9c21  fix: raise SSO timeout to survive provider latency spikes
  77b0e14  feat: add session bootstrap
```

The model is plumbing, not the headline. The **output is the product**: a NexBridge answer
leads with the decision and its reason, cites evidence you can verify, and says *"the history
is silent"* rather than inventing a plausible motive. Confabulation is the one thing it must
never do.

## Install

Requires **Node ≥ 20**, **git**, and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/dentoverhoed/NexBridge.git
cd NexBridge
pnpm install
pnpm build      # -> dist/cli.js (the `lore` binary)
```

## A narrator: zero keys with Ollama, or bring your own

NexBridge talks to a model only in its final stage, behind one pluggable interface. It picks
automatically:

1. **Ollama (local, default)** — if an [Ollama](https://ollama.com) daemon is running, it is
   used. Fully local, **no API keys**, your history never leaves the machine.
   ```bash
   ollama pull llama3.1:8b
   ```
2. **Anthropic (hosted)** — used as a fallback when Ollama is not running and a key is set.
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

If neither is available, NexBridge tells you exactly how to fix it.

## Usage

```bash
lore why <file>:<line>

# during development, without building:
pnpm dev -- why src/collect/git.ts:100
```

The line is required — NexBridge explains a specific line as it exists at `HEAD`.

### Configuration

| Variable             | Effect                                              | Default                  |
| -------------------- | --------------------------------------------------- | ------------------------ |
| `OLLAMA_HOST`        | Ollama daemon URL                                   | `http://localhost:11434` |
| `LORE_OLLAMA_MODEL`  | Ollama model tag                                    | `llama3.1`               |
| `ANTHROPIC_API_KEY`  | Enables the hosted Anthropic narrator               | —                        |
| `LORE_MODEL`         | Anthropic model id                                  | `claude-opus-4-8`        |

## How it works

Three stages, cleanly separated and independently testable. Data flows one way:
**Collect → Assemble → Narrate.**

1. **Collect** (`src/collect/`) — raw evidence, no interpretation. The load-bearing primitive
   is `git log -L <line>,<line>:<file>` with a sentinel `--format`, which yields the commits
   that changed the exact line **and** their diff hunks in one parseable pass — and follows
   the line across file renames. The introducing commit is the bottom of that chain (not
   `git blame`, which only reports the last modifier).
2. **Assemble** (`src/assemble/`) — pure functions turn raw commits into a ranked `Dossier`:
   commits that touched the line rank above file-only ones, recency breaks ties. Evidence is
   flagged *thin* when it is sparse **or** low-signal (a wall of `fix` / `wip` / `init`), which
   routes the narrator toward admitting silence instead of guessing.
3. **Narrate** (`src/narrate/`) — the only stage that touches a model. A deterministic prompt
   carries the line's diff hunks so the model can check what a commit message *claims* against
   what the code *does*, and is forbidden from fabricating SHAs, URLs, or issue links.

## Development

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint + prettier
pnpm test           # vitest (real throwaway git repos, pinned dates)
pnpm build          # tsup -> dist/
```

There is also a no-key harness that prints the dossier + prompt for sample targets so the
Collect/Assemble quality can be reviewed without spending a model call:

```bash
tsx test/manual/dump-prompt.ts
tsx test/manual/gate.ts          # full pipeline through the real narrator
```

## Status

This is **slice 1** — the thin vertical slice that proves the bet (is the synthesis good?).
It is built, tested, and has passed a validation gate against a local model on targets with
known ground truth, including a confabulation trap it correctly refused to answer.

**Shipped:** git-only Collect (rename-aware), ranked Dossier with thin-evidence detection,
deterministic prompt, Ollama + Anthropic narrators behind one interface with auto-resolution.

**Not yet:** forge adapters (PR / issue mining), a TUI, streaming, response caching, an
OpenAI-compatible narrator, whole-file and symbol targeting. The types already accommodate
them.

## License

MIT
