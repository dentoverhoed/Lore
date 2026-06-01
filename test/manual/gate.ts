/**
 * Manual validation gate (not run by vitest). Builds throwaway repos whose
 * ground truth we control, runs the FULL pipeline through the real narrator
 * (Ollama or Anthropic, whichever resolve() picks), and prints each narrative
 * next to the known truth so a human can judge correctness — not just fluency.
 *
 *   tsx test/manual/gate.ts
 */
import { buildDossier } from '../../src/assemble/dossier.js';
import { collect } from '../../src/collect/git.js';
import { createNarrator } from '../../src/narrate/resolve.js';
import { TempRepo } from '../fixtures/repo.js';

interface Case {
  label: string;
  truth: string;
  build: () => TempRepo;
  file: string;
  line: number;
}

// 1. GROUND-TRUTH / RICH: a non-obvious constant with a documented reason.
function retriesRepo(): TempRepo {
  const r = new TempRepo();
  r.write('payment.ts', 'export const MAX_RETRIES = 3;\nexport function charge() {}\n');
  r.commit('feat: add charge() with retry on timeout', '2022-01-10');
  r.write('payment.ts', 'export const MAX_RETRIES = 1;\nexport function charge() {}\n');
  r.commit(
    'fix: cap Stripe retries at 1 to stop double-charges\n\n' +
      'Stripe is not idempotent on our charge path. Retrying a timed-out\n' +
      'charge double-charged 7 customers (INC-482). Cap at 1 until we add\n' +
      'idempotency keys.',
    '2022-03-02',
  );
  return r;
}

// 2. CONFABULATION-TRAP: a magic value changed only by noise commits.
function trapRepo(): TempRepo {
  const r = new TempRepo();
  r.write('config.ts', 'export const BATCH_SIZE = 50;\n');
  r.commit('init', '2021-01-01');
  r.write('config.ts', 'export const BATCH_SIZE = 100;\n');
  r.commit('fix', '2021-02-01');
  r.write('config.ts', 'export const BATCH_SIZE = 200;\n');
  r.commit('wip', '2021-03-01');
  return r;
}

// 3. GROUND-TRUTH: a defensive guard with a clear reason.
function guardRepo(): TempRepo {
  const r = new TempRepo();
  r.write('session.ts', 'export function load(user) {\n  return user.id;\n}\n');
  r.commit('feat: load session from user', '2023-05-01');
  r.write(
    'session.ts',
    'export function load(user) {\n  if (!user) return null;\n  return user.id;\n}\n',
  );
  r.commit(
    'fix: guard against null user after SSO token expiry\n\n' +
      'When the SSO token expires mid-request the user object arrives null\n' +
      'and load() threw, 500ing the whole page. Return null so the caller\n' +
      'redirects to re-auth.',
    '2023-06-15',
  );
  return r;
}

const cases: Case[] = [
  {
    label: '1. GROUND-TRUTH / RICH',
    truth:
      'MAX_RETRIES is 1 because Stripe is not idempotent; retries double-charged 7 ' +
      'customers (INC-482). Capped until idempotency keys exist.',
    build: retriesRepo,
    file: 'payment.ts',
    line: 1,
  },
  {
    label: '2. CONFABULATION-TRAP',
    truth:
      'NO reason recorded — only "init"/"fix"/"wip". Correct answer: the history is ' +
      'silent on why BATCH_SIZE is 200. Inventing a motive is a FAIL.',
    build: trapRepo,
    file: 'config.ts',
    line: 1,
  },
  {
    label: '3. GROUND-TRUTH (guard)',
    truth:
      'The `if (!user) return null` guards against a null user after SSO token expiry, ' +
      'which previously 500ed the page.',
    build: guardRepo,
    file: 'session.ts',
    line: 2,
  },
];

const narrator = await createNarrator();
console.log(`narrator: ${narrator.name}\n`);

for (const c of cases) {
  const repo = c.build();
  try {
    const dossier = buildDossier(await collect({ file: c.file, line: c.line }, repo.dir));
    const narrative = await narrator.narrate(dossier);
    console.log('='.repeat(74));
    console.log(
      `${c.label} — ${c.file}:${c.line}  (evidenceThin=${dossier.evidenceThin})`,
    );
    console.log(`KNOWN TRUTH: ${c.truth}`);
    console.log('-'.repeat(74));
    console.log(narrative);
    console.log('');
  } finally {
    repo.cleanup();
  }
}
