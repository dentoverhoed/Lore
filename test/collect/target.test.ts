import { describe, expect, it } from 'vitest';

import { parseTarget } from '../../src/collect/target.js';
import { LoreError } from '../../src/errors.js';

describe('parseTarget', () => {
  it('parses file:line', () => {
    expect(parseTarget('src/auth/session.ts:88')).toEqual({
      file: 'src/auth/session.ts',
      line: 88,
    });
  });

  it('splits on the last colon (survives Windows drive letters)', () => {
    expect(parseTarget('C:/repo/src/foo.ts:42')).toEqual({
      file: 'C:/repo/src/foo.ts',
      line: 42,
    });
  });

  it('rejects a bare file with no line', () => {
    expect(() => parseTarget('src/foo.ts')).toThrow(LoreError);
  });

  it('rejects a non-numeric line', () => {
    expect(() => parseTarget('src/foo.ts:abc')).toThrow(LoreError);
  });

  it('rejects line zero', () => {
    expect(() => parseTarget('src/foo.ts:0')).toThrow(LoreError);
  });
});
