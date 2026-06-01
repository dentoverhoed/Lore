/**
 * Manual harness (not run by `vitest`): builds throwaway repos for the gate's
 * target kinds and prints the dossier + prompt the model would receive, so the
 * Collect/Assemble quality can be eyeballed without an API key.
 *
 *   tsx test/manual/dump-prompt.ts
 */
import { buildDossier } from '../../src/assemble/dossier.js';
import { collect } from '../../src/collect/git.js';
import { buildPrompt } from '../../src/narrate/prompt.js';
import { buildBiographyRepo, TempRepo } from '../fixtures/repo.js';

async function dump(label: string, repo: TempRepo, file: string, line: number) {
  const collected = await collect({ file, line }, repo.dir);
  const dossier = buildDossier(collected);
  console.log(`\n${'='.repeat(70)}\n${label} — ${file}:${line}\n${'='.repeat(70)}`);
  console.log(`evidenceThin=${dossier.evidenceThin}  introducing=${dossier.introducingSha?.slice(0, 7)}`);
  console.log(
    'ranked commits:',
    dossier.commits.map((c) => `${c.shortSha}${c.touchedTargetLine ? '*' : ' '} ${c.subject}`),
  );
  console.log('\n--- prompt.user ---\n' + buildPrompt(dossier).user);
  repo.cleanup();
}

function trapRepo(): TempRepo {
  const repo = new TempRepo();
  repo.write('config.ts', 'export const RETRIES = 1;\n');
  repo.commit('init', '2021-01-01');
  repo.write('config.ts', 'export const RETRIES = 2;\n');
  repo.commit('fix', '2021-02-01');
  repo.write('config.ts', 'export const RETRIES = 3;\n');
  repo.commit('wip', '2021-03-01');
  return repo;
}

await dump('GROUND-TRUTH (why: guard + fallback)', buildBiographyRepo(), 'new.ts', 2);
await dump('CONFABULATION-TRAP (noise commits)', trapRepo(), 'config.ts', 1);
