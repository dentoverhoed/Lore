import { LoreError } from '../errors.js';
import { strings } from '../strings.js';
import type { Target } from '../types.js';

/**
 * Parse "src/foo.ts:42" into a Target. The line is required in slice 1 — the
 * whole design is line-centric. A bare file, or anything else, is a clear error.
 */
export function parseTarget(raw: string): Target {
  // Split on the LAST colon so Windows drive letters / nested colons survive.
  const idx = raw.lastIndexOf(':');
  if (idx === -1) {
    throw new LoreError(strings.missingLine(raw));
  }

  const file = raw.slice(0, idx);
  const lineStr = raw.slice(idx + 1);

  if (file.length === 0) {
    throw new LoreError(strings.badTarget(raw));
  }
  if (!/^\d+$/.test(lineStr)) {
    throw new LoreError(strings.badTarget(raw));
  }

  const line = Number.parseInt(lineStr, 10);
  if (line < 1) {
    throw new LoreError(strings.badTarget(raw));
  }

  return { file, line };
}
