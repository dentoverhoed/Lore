import { buildDossier } from './assemble/dossier.js';
import { collect } from './collect/git.js';
import { parseTarget } from './collect/target.js';
import { LoreError } from './errors.js';
import { createNarrator } from './narrate/resolve.js';
import { redactUnknownShas } from './narrate/validate.js';
import { strings } from './strings.js';

async function main(argv: string[]): Promise<number> {
  const [command, rawTarget] = argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(strings.usage);
    return command ? 0 : 1;
  }
  if (command !== 'why') {
    console.error(strings.usage);
    return 1;
  }
  if (!rawTarget) {
    console.error(strings.noTarget);
    return 1;
  }

  const target = parseTarget(rawTarget);
  const collected = await collect(target, process.cwd());

  if (collected.shallow) {
    console.error(strings.shallowWarning);
    console.error('');
  }

  const dossier = buildDossier(collected);

  if (dossier.commits.length === 0) {
    console.log(strings.noHistory(target.file, target.line));
    return 0;
  }

  const narrator = await createNarrator();
  const narrative = await narrator.narrate(dossier);

  const knownShas = dossier.commits.flatMap((c) => [c.sha, c.shortSha]);
  if (dossier.introducingSha) knownShas.push(dossier.introducingSha);

  console.log(redactUnknownShas(narrative, knownShas));
  console.log('');
  console.log(strings.sourcesHeader);
  for (const c of dossier.commits) {
    console.log(`  ${c.shortSha}  ${c.subject}`);
  }

  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    if (err instanceof LoreError) {
      console.error(err.message);
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  });
