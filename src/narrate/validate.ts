/**
 * Post-narration safety gate. The prompt asks the model to cite only real short
 * SHAs, but a small local model will still parrot an example hash or invent a
 * plausible 7-hex token mid-sentence. Confabulation is the cardinal sin here, so
 * we verify every SHA-looking token in the narrative against the dossier's real
 * SHAs and redact the ones that don't check out.
 */

/** A hex run long enough to look like a commit SHA (git abbreviates to >=7). */
const SHA_TOKEN = /[0-9a-fA-F]{7,40}/;

function makeIsKnown(known: Iterable<string>): (sha: string) => boolean {
  const set = new Set<string>();
  for (const k of known) if (k) set.add(k.toLowerCase());
  return (sha: string): boolean => {
    const s = sha.toLowerCase();
    if (set.has(s)) return true;
    // A citation is valid if it is an abbreviation of a real full SHA, or an
    // extension of a real short SHA — git lets you cite at any length >=7.
    for (const k of set) {
      if (k.startsWith(s) || s.startsWith(k)) return true;
    }
    return false;
  };
}

/**
 * Replace every SHA-looking token in `text` that is not backed by a real SHA in
 * `known`. Parenthetical citations like `(a1b2c3d)` collapse to `(unverified)`;
 * bare tokens become `[unverified]`, so the fabrication is visible rather than
 * passed off as evidence.
 */
export function redactUnknownShas(text: string, known: Iterable<string>): string {
  const isKnown = makeIsKnown(known);
  const paren = new RegExp(`\\(\\s*(${SHA_TOKEN.source})\\s*\\)`, 'g');
  const bare = new RegExp(`\\b(${SHA_TOKEN.source})\\b`, 'g');
  return text
    .replace(paren, (m, sha: string) => (isKnown(sha) ? m : '(unverified)'))
    .replace(bare, (m, sha: string) => (isKnown(sha) ? m : '[unverified]'));
}
