import type { Dossier } from '../types.js';

/**
 * The seam every model provider plugs into. Slice 1 ships one implementation
 * (Anthropic); Ollama / OpenAI-compatible adapters land later behind this same
 * interface. No streaming yet — it adds nothing to answering "is the output good?".
 */
export interface Narrator {
  /** Stable identifier, e.g. "anthropic". */
  readonly name: string;
  /** Produce a sourced narrative from the dossier. */
  narrate(dossier: Dossier): Promise<string>;
}
