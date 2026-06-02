import { describe, expect, it } from 'vitest';

import { redactUnknownShas } from '../../src/narrate/validate.js';

const known = ['d5482c4ce9ab1122334455667788990011223344', 'd5482c4'];

describe('redactUnknownShas', () => {
  it('keeps a real short SHA citation', () => {
    expect(redactUnknownShas('Fixed in (d5482c4).', known)).toBe('Fixed in (d5482c4).');
  });

  it('keeps an abbreviation of a real full SHA at any length >=7', () => {
    expect(redactUnknownShas('see (d5482c4ce9ab)', known)).toBe('see (d5482c4ce9ab)');
  });

  it('redacts a fabricated parenthetical SHA', () => {
    expect(redactUnknownShas('related to (a1b2c3d) which adds X', known)).toBe(
      'related to (unverified) which adds X',
    );
  });

  it('redacts a fabricated bare SHA', () => {
    expect(redactUnknownShas('commit a1b2c3d did it', known)).toBe(
      'commit [unverified] did it',
    );
  });

  it('leaves prose without SHAs untouched', () => {
    expect(redactUnknownShas('The history is silent on this.', known)).toBe(
      'The history is silent on this.',
    );
  });

  it('does not flag short hex runs (<7 chars)', () => {
    expect(redactUnknownShas('color #abc123 stays', known)).toBe('color #abc123 stays');
  });

  it('redacts when there is no known SHA at all', () => {
    expect(redactUnknownShas('(deadbee) appeared', [])).toBe('(unverified) appeared');
  });
});
