/** A failure we can explain to the user with a suggested fix (see strings.ts). */
export class LoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoreError';
  }
}
