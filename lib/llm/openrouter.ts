/**
 * Chat-completions client: OpenRouter first; OpenAI or Gemini direct as
 * alternatives.
 *
 * Every model REPEAT can use — OpenAI, Anthropic, Google, open weights — is
 * reached through OpenRouter's single OpenAI-compatible endpoint, so changing
 * the model is an environment variable, not a code change. Because the wire
 * format is OpenAI's, the same client can also talk to OpenAI directly
 * (OPENAI_API_KEY) or to the Gemini API's OpenAI-compatible endpoint
 * (GEMINI_API_KEY). The key lives on the server only; this module is never
 * imported by client code.
 *
 * The client does one thing: ask for a JSON object and hand back the raw
 * text. Validation is the caller's job, because the caller owns the schema.
 */

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
/** Gemini's OpenAI-compatibility layer (ai.google.dev/gemini-api/docs/openai). */
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/**
 * Fast, cheap, and reliably emits JSON. Overridable with OPENROUTER_MODEL;
 * OPENROUTER_FALLBACK_MODELS adds models OpenRouter may route to if the
 * primary is down or rate-limited.
 */
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4.1-mini';
/** The same model, in OpenAI's own naming, for the direct path. */
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
/** Fast and cheap; the same model passed the live self-test via OpenRouter. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export type LlmProvider = 'openrouter' | 'openai' | 'gemini';

export type LlmConfig = {
  provider: LlmProvider;
  /** Chat-completions endpoint. */
  url: string;
  apiKey: string;
  model: string;
  /** OpenRouter model routing; ignored by the direct OpenAI path. */
  fallbackModels: string[];
  /** Sent as HTTP-Referer so the app is attributed on openrouter.ai. */
  siteUrl: string;
  appName: string;
};

/** Kept for readers of the earlier name. */
export type OpenRouterConfig = LlmConfig;

export type JsonCompletion = {
  /** The assistant message text — expected to be a JSON object. */
  text: string;
  /** The model that actually answered, as reported by the provider. */
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
  latencyMs: number;
};

export class OpenRouterError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

const PROVIDER_LABEL: Record<LlmProvider, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

/** Human name of a provider, for the Ghost Run and the timeline. */
export function providerLabel(provider: LlmProvider | undefined): string {
  return provider ? PROVIDER_LABEL[provider] : PROVIDER_LABEL.openrouter;
}

/**
 * Read configuration from the environment. Precedence when several keys are
 * present: OpenRouter (the path that was demoed and tested most), then
 * OpenAI, then Gemini. Null when no key is set at all.
 */
export function llmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const siteUrl = env.OPENROUTER_SITE_URL?.trim() || 'https://github.com/4waiz/REPEAT';
  const appName = 'REPEAT';

  const openRouterKey = env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      provider: 'openrouter',
      url: OPENROUTER_URL,
      apiKey: openRouterKey,
      model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      fallbackModels: (env.OPENROUTER_FALLBACK_MODELS ?? '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      siteUrl,
      appName,
    };
  }

  const openAiKey = env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      provider: 'openai',
      url: env.OPENAI_BASE_URL?.trim() || OPENAI_URL,
      apiKey: openAiKey,
      model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      fallbackModels: [],
      siteUrl,
      appName,
    };
  }

  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      provider: 'gemini',
      url: GEMINI_URL,
      apiKey: geminiKey,
      model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      fallbackModels: [],
      siteUrl,
      appName,
    };
  }

  return null;
}

/** Kept for readers of the earlier name. */
export const openRouterConfig = llmConfig;

type ChatResponse = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
};

/**
 * One chat completion that must answer with a JSON object.
 *
 * `temperature: 0` because classification should be repeatable, and
 * `response_format: json_object` because every model we would route to
 * supports it; OpenRouter drops the parameter for any that do not, and the
 * caller still extracts the first `{...}` defensively.
 */
export async function completeJson(
  config: LlmConfig,
  input: { system: string; user: string; maxTokens?: number; timeoutMs: number },
): Promise<JsonCompletion> {
  const label = PROVIDER_LABEL[config.provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();

  const models = [config.model, ...config.fallbackModels];

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
        // Attribution headers; OpenRouter reads them, the others ignore them.
        'http-referer': config.siteUrl,
        'x-title': config.appName,
      },
      body: JSON.stringify({
        model: config.model,
        // Model routing: OpenRouter tries these in order if the primary fails.
        ...(config.provider === 'openrouter' && models.length > 1 ? { models } : {}),
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        max_tokens: input.maxTokens ?? 1024,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new OpenRouterError(`${label} timed out after ${input.timeoutMs}ms`);
    }
    throw new OpenRouterError(
      `${label} unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  let data: ChatResponse;
  try {
    data = (await response.json()) as ChatResponse;
  } catch {
    throw new OpenRouterError(`${label} returned ${response.status} with a non-JSON body`, response.status);
  }

  if (!response.ok || data.error) {
    throw new OpenRouterError(
      `${label} returned ${response.status}${data.error?.message ? `: ${data.error.message}` : ''}`,
      response.status,
    );
  }

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new OpenRouterError(`${label} returned an empty completion`, response.status);

  return {
    text,
    model: data.model ?? config.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
        }
      : undefined,
    latencyMs: Date.now() - started,
  };
}
