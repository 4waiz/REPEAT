import type { IssueReference, IssueUnderstanding, MailMessage } from '@/types';
import { completeJson, llmConfig, type LlmConfig, type LlmProvider } from '@/lib/llm/openrouter';
import { buildResearchQuery, exaApiKey, searchRelated } from '@/lib/research/exa';
import {
  UNDERSTANDING_SYSTEM_PROMPT,
  buildUnderstandingUserPrompt,
  mergeUnderstanding,
  understandDeterministic,
  validateModelAnswer,
} from './understanding';

/**
 * Live understanding: the step REPEAT performs itself when it acts.
 *
 * Two independent passes run in parallel over the same report:
 *
 *   understand — a model via OpenRouter reads the report and returns the
 *                structured interpretation. Zod-validated; every cited piece
 *                of evidence must be a literal quote; falls back to the
 *                deterministic classifier on any failure.
 *   research   — Exa searches for related public context (docs, similar
 *                issues, status posts) using only the symptom phrase. Results
 *                are attached to the ticket; a failure attaches nothing.
 *
 * Neither pass can break the run. The worst case is the deterministic answer
 * with no references — which is exactly what Demo Mode produces.
 *
 * Server-only. The API route and the live self-test are the two callers.
 */

/** Hard ceilings so a slow provider cannot stall a live demo. */
export const LLM_TIMEOUT_MS = 8000;
export const RESEARCH_TIMEOUT_MS = 6000;

export type UnderstandingProvenance = {
  usedLlm: boolean;
  /** The model that answered, as reported by the provider. */
  model?: string;
  /** OpenRouter (default) or OpenAI direct. */
  provider?: LlmProvider;
  llmLatencyMs?: number;
  /** Why the deterministic classifier was used instead. */
  fallbackReason?: string;
  usedResearch: boolean;
  /** Exactly what was sent to Exa — shown to the user, because it is the only thing that leaves. */
  researchQuery?: string;
  referenceCount: number;
  researchLatencyMs?: number;
  /** Why no references were attached. */
  researchReason?: string;
};

export type LiveUnderstanding = {
  understanding: IssueUnderstanding;
  provenance: UnderstandingProvenance;
};

type Options = {
  env?: NodeJS.ProcessEnv;
  llmTimeoutMs?: number;
  researchTimeoutMs?: number;
};

export async function understandLive(
  message: MailMessage,
  options: Options = {},
): Promise<LiveUnderstanding> {
  const env = options.env ?? process.env;

  // Computed first, unconditionally: it is the fallback for the model pass
  // and the source of the research query.
  const deterministic = understandDeterministic(message);

  const [model, research] = await Promise.all([
    runModelPass(llmConfig(env), message, deterministic, options.llmTimeoutMs ?? LLM_TIMEOUT_MS),
    runResearchPass(exaApiKey(env), message, deterministic, options.researchTimeoutMs ?? RESEARCH_TIMEOUT_MS),
  ]);

  const understanding: IssueUnderstanding = {
    ...model.understanding,
    ...(research.references.length ? { references: research.references } : {}),
  };

  return {
    understanding,
    provenance: {
      usedLlm: model.understanding.source === 'llm',
      model: model.understanding.model,
      provider: model.understanding.provider,
      llmLatencyMs: model.latencyMs,
      fallbackReason: model.fallbackReason,
      usedResearch: research.references.length > 0,
      researchQuery: research.query,
      referenceCount: research.references.length,
      researchLatencyMs: research.latencyMs,
      researchReason: research.reason,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* passes — each one resolves, never rejects                                */
/* ------------------------------------------------------------------------ */

async function runModelPass(
  config: LlmConfig | null,
  message: MailMessage,
  deterministic: IssueUnderstanding,
  timeoutMs: number,
): Promise<{ understanding: IssueUnderstanding; latencyMs?: number; fallbackReason?: string }> {
  if (!config) {
    return {
      understanding: deterministic,
      fallbackReason: 'No model key set (OPENROUTER_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY)',
    };
  }

  try {
    const completion = await completeJson(config, {
      system: UNDERSTANDING_SYSTEM_PROMPT,
      user: buildUnderstandingUserPrompt(message),
      timeoutMs,
    });
    // Zod is the gate: anything that does not satisfy the contract, or
    // cites evidence that is not in the report, is refused in full.
    const payload = validateModelAnswer(completion.text, message);
    return {
      understanding: mergeUnderstanding(deterministic, payload, completion.model, config.provider),
      latencyMs: completion.latencyMs,
    };
  } catch (error) {
    return {
      understanding: deterministic,
      fallbackReason: error instanceof Error ? error.message : 'unknown model failure',
    };
  }
}

async function runResearchPass(
  apiKey: string | null,
  message: MailMessage,
  deterministic: IssueUnderstanding,
  timeoutMs: number,
): Promise<{ references: IssueReference[]; query?: string; latencyMs?: number; reason?: string }> {
  if (!apiKey) return { references: [], reason: 'EXA_API_KEY is not set' };

  // Research needs a symptom. A report that did not classify has none, and
  // searching for "something went wrong" would attach noise to the ticket.
  if (deterministic.area === 'unresolved') {
    return { references: [], reason: 'No concrete symptom to research' };
  }

  const query = buildResearchQuery(message, deterministic.category);
  if (!query) return { references: [], reason: 'No symptom to search for' };

  try {
    const result = await searchRelated(apiKey, { query, timeoutMs });
    return {
      references: result.references,
      query,
      latencyMs: result.latencyMs,
      reason: result.references.length ? undefined : 'Exa returned no related pages',
    };
  } catch (error) {
    return {
      references: [],
      query,
      reason: error instanceof Error ? error.message : 'unknown research failure',
    };
  }
}
