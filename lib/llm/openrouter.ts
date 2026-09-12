/**
 * OpenRouter client.
 *
 * Every model REPEAT can use — OpenAI, Anthropic, Google, open weights — is
 * reached through OpenRouter's single OpenAI-compatible endpoint, so changing
 * the model is an environment variable, not a code change. The key lives on
 * the server only; this module is never imported by client code.
 *
 * The client does one thing: ask for a JSON object and hand back the raw
 * text. Validation is the caller's job, because the caller owns the schema.
 */

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Fast, cheap, and reliably emits JSON. Overridable with OPENROUTER_MODEL;
 * OPENROUTER_FALLBACK_MODELS adds models OpenRouter may route to if the
 * primary is down or rate-limited.
 */
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4.1-mini';

export type OpenRouterConfig = {
  apiKey: string;
  model: string;
  fallbackModels: string[];
  /** Sent as HTTP-Referer so the app is attributed on openrouter.ai. */
  siteUrl: string;
  appName: string;
};

export type JsonCompletion = {
  /** The assistant message text — expected to be a JSON object. */
  text: string;
  /** The model that actually answered, as reported by OpenRouter. */
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

/** Read configuration from the environment. Null when no key is set. */
export function openRouterConfig(env: NodeJS.ProcessEnv = process.env): OpenRouterConfig | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    fallbackModels: (env.OPENROUTER_FALLBACK_MODELS ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    siteUrl: env.OPENROUTER_SITE_URL?.trim() || 'https://github.com/4waiz/REPEAT',
    appName: 'REPEAT',
  };
}

type ChatResponse = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number };
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
  config: OpenRouterConfig,
  input: { system: string; user: string; maxTokens?: number; timeoutMs: number },
): Promise<JsonCompletion> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();

  const models = [config.model, ...config.fallbackModels];

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
        'http-referer': config.siteUrl,
        'x-title': config.appName,
      },
      body: JSON.stringify({
        model: config.model,
        // Model routing: OpenRouter tries these in order if the primary fails.
        ...(models.length > 1 ? { models } : {}),
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
      throw new OpenRouterError(`OpenRouter timed out after ${input.timeoutMs}ms`);
    }
    throw new OpenRouterError(
      `OpenRouter unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  let data: ChatResponse;
  try {
    data = (await response.json()) as ChatResponse;
  } catch {
    throw new OpenRouterError(`OpenRouter returned ${response.status} with a non-JSON body`, response.status);
  }

  if (!response.ok || data.error) {
    throw new OpenRouterError(
      `OpenRouter returned ${response.status}${data.error?.message ? `: ${data.error.message}` : ''}`,
      response.status,
    );
  }

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new OpenRouterError('OpenRouter returned an empty completion', response.status);

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
