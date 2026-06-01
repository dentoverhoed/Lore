/**
 * Every user-facing string lives here and reads like a human wrote it.
 * Error messages suggest the fix. The word "AI" appears nowhere.
 */

export const strings = {
  usage: `lore — why is this code like this?

Usage:
  lore why <file>:<line>

Example:
  lore why src/auth/session.ts:88`,

  noTarget: 'Tell me what to look at: lore why <file>:<line>',

  missingLine: (file: string) =>
    `Point me at a line, not just a file: try "${file}:<line>". ` +
    `(Whole-file explanations are not supported yet.)`,

  badTarget: (raw: string) =>
    `Could not read "${raw}" as <file>:<line>. Example: src/auth/session.ts:88`,

  notARepo: (dir: string) =>
    `${dir} is not inside a git repository. lore reads git history, so it needs one. ` +
    `Run it from a cloned repo (or "git init" if this is a new project).`,

  fileNotFound: (file: string) =>
    `Git has no record of "${file}". Check the path is spelled right and is tracked by git.`,

  lineNotOnHead: (file: string, line: number) =>
    `Line ${line} no longer exists in ${file} at HEAD (the file is shorter, or the line ` +
    `was deleted or moved). lore explains lines as they are now — point me at the line ` +
    `where the code currently lives.`,

  shallowWarning:
    'Note: this is a shallow clone, so history is truncated — the answer may miss the ' +
    'commit that actually explains this. Run "git fetch --unshallow" for the full story.',

  missingApiKey:
    'No ANTHROPIC_API_KEY found in the environment. Set it to let lore narrate, e.g.\n' +
    '  export ANTHROPIC_API_KEY=sk-ant-...',

  gitFailed: (detail: string) => `git failed: ${detail}`,

  sourcesHeader: 'Sources',

  noHistory: (file: string, line: number) =>
    `git has no commits touching ${file}:${line}. The history is silent on this one.`,
} as const;
