import type { Dossier, DossierCommit } from '../types.js';

/** A model request, split so adapters can map it to their own shapes. */
export interface Prompt {
  system: string;
  user: string;
}

const SYSTEM = `You explain why a specific line of code is the way it is, using only the git history provided. You are the senior engineer who was in the room — clear, honest, and brief.

Rules, in order of importance:
1. NEVER invent a reason. If the provided history does not explain the line, say plainly that the history is silent on it. Guessing a plausible-sounding motive is the worst thing you can do.
2. Lead with the decision and its reason — not a chronological timeline.
3. Cite your evidence inline using ONLY a short commit SHA copied verbatim from the evidence below, wrapped in parens like (<sha>). Use ONLY SHAs that literally appear below — never type a SHA from memory and never copy the SHA in these instructions; if a hash is not in the evidence, it does not exist. Never fabricate a URL, PR number, or issue link either.
4. Distinguish what a commit message CLAIMS from what the diff actually DOES. You are given the line's diff hunks — use them to check the claims.
5. Be short. A trusted paragraph beats an exhausting page. No preamble, no "Based on the git history". Just the answer.

Do not mention being a model or use the word "AI".`;

function renderCommit(c: DossierCommit): string {
  const lines = [
    `commit ${c.shortSha} — ${c.date} — ${c.author}`,
    `  ${c.touchedTargetLine ? 'TOUCHED THE LINE' : 'touched the file'}`,
    `  subject: ${c.subject}`,
  ];
  if (c.body.trim()) {
    lines.push(`  message body:`);
    for (const bl of c.body.trim().split('\n')) lines.push(`    ${bl}`);
  }
  if (c.hunk && c.hunk.trim()) {
    lines.push(`  diff of the line at this commit:`);
    for (const hl of c.hunk.trim().split('\n')) lines.push(`    ${hl}`);
  }
  return lines.join('\n');
}

/** Deterministic: same Dossier in, same Prompt out. This is what we unit-test. */
export function buildPrompt(dossier: Dossier): Prompt {
  const { target, lineContent, commits, evidenceThin, shallow } = dossier;

  const header = [
    `Question: why is line ${target.line} of ${target.file} the way it is?`,
    ``,
    `The line currently reads:`,
    `  ${lineContent || '(empty / unavailable)'}`,
    ``,
  ];

  if (shallow) {
    header.push(
      `WARNING: this is a shallow clone — the history below may be truncated. ` +
        `Factor that uncertainty into your answer.`,
      ``,
    );
  }

  if (evidenceThin) {
    header.push(
      `NOTE: the evidence below is thin or low-signal. If it does not actually ` +
        `explain the line, say the history is silent — do not manufacture a reason.`,
      ``,
    );
  }

  const body =
    commits.length === 0
      ? `No commits were found for this line. The history is silent.`
      : `Commits, most relevant first:\n\n` + commits.map(renderCommit).join('\n\n');

  return { system: SYSTEM, user: header.join('\n') + body };
}
