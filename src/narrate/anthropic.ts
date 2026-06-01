import Anthropic from '@anthropic-ai/sdk';

import { LoreError } from '../errors.js';
import { strings } from '../strings.js';
import type { Dossier } from '../types.js';
import { buildPrompt } from './prompt.js';
import type { Narrator } from './types.js';

const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1024;

export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
}

/** The one narrator in slice 1. Cloud, needs ANTHROPIC_API_KEY. */
export function createAnthropicNarrator(opts: AnthropicOptions = {}): Narrator {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new LoreError(strings.missingApiKey);
  }
  const model = opts.model ?? process.env.LORE_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    async narrate(dossier: Dossier): Promise<string> {
      const { system, user } = buildPrompt(dossier);
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      });
      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
    },
  };
}
