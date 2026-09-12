import { BuiltInAgent, CopilotRuntime, createCopilotRuntimeHandler } from '@copilotkit/runtime/v2';
import { EventType, type BaseEvent } from '@ag-ui/client';
import type { LearnedPattern, MailMessage } from '@/types';
import { planRun } from '@/lib/agents/ghost-runner';
import { understandLive } from '@/lib/agents/understanding-live';
import {
  GHOST_AGENT_ID,
  GHOST_CONTEXT_PATTERN,
  GHOST_CONTEXT_REPORT,
  GHOST_TOOL_ACTION,
  GHOST_TOOL_RUN,
} from '@/lib/agents/ghost-agent';
import { DEMO_MODE } from '@/lib/demo/config';

/**
 * CopilotKit runtime — REPEAT's planner as an AG-UI agent.
 *
 * There is still no chat and no prompt. The agent named `ghost` is REPEAT's
 * own Ghost Run planner: given the new report and the learned pattern (shared
 * by the browser as agent context), it reads the report with the model,
 * researches it, plans the run through the unchanged planner, and streams
 * every proposed action back as an AG-UI tool call — generative UI that the
 * Ghost Run panel renders in its own layout as the plan materialises.
 *
 * Approval and execution are not here: they stay with REPEAT's policy layer
 * and /api/execute. Demo Mode never mounts the provider, so this route is
 * idle offline; if it is called anyway it answers with an empty run.
 *
 * Multi-route handler (docs.copilotkit.ai/backend/runtime-endpoints):
 *   GET  /api/copilotkit/info                 agent discovery
 *   POST /api/copilotkit/agent/ghost/run      AG-UI RunAgentInput -> SSE events
 */

export const runtime = 'nodejs';

function contextValue(input: { context?: { description: string; value: string }[] }, key: string): string | null {
  return input.context?.find((c) => c.description === key)?.value ?? null;
}

const ghost = new BuiltInAgent({
  type: 'custom',
  factory: async function* ({ input, abortSignal }) {
    if (DEMO_MODE) return;

    // The run input carries the report and pattern explicitly (forwardedProps);
    // the same two are also available as agent context for tools to read.
    const forwarded = (input.forwardedProps ?? {}) as Record<string, unknown>;
    const reportJson =
      (typeof forwarded[GHOST_CONTEXT_REPORT] === 'string' ? (forwarded[GHOST_CONTEXT_REPORT] as string) : null) ??
      contextValue(input, GHOST_CONTEXT_REPORT);
    const patternJson =
      (typeof forwarded[GHOST_CONTEXT_PATTERN] === 'string' ? (forwarded[GHOST_CONTEXT_PATTERN] as string) : null) ??
      contextValue(input, GHOST_CONTEXT_PATTERN);
    if (!reportJson || !patternJson) return;

    const message = JSON.parse(reportJson) as MailMessage;
    const pattern = JSON.parse(patternJson) as LearnedPattern;
    const issueNumber = Number(forwarded.issueNumber ?? 0);

    // The same live pass and the same planner the REST path uses.
    const live = await understandLive(message);
    if (abortSignal.aborted) return;
    const run = planRun(pattern, message, live.understanding, issueNumber);

    const parentMessageId = crypto.randomUUID();
    const toolCall = function* (name: string, args: unknown): Generator<BaseEvent> {
      const toolCallId = crypto.randomUUID();
      yield { type: EventType.TOOL_CALL_START, parentMessageId, toolCallId, toolCallName: name } as BaseEvent;
      yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(args) } as BaseEvent;
      yield { type: EventType.TOOL_CALL_END, toolCallId } as BaseEvent;
    };

    // One tool call per proposed action, in plan order, then the whole run.
    for (const action of run.proposedActions) yield* toolCall(GHOST_TOOL_ACTION, action);
    yield* toolCall(GHOST_TOOL_RUN, { run, provenance: live.provenance });
  },
});

const copilotRuntime = new CopilotRuntime({ agents: { [GHOST_AGENT_ID]: ghost } });

const handler = createCopilotRuntimeHandler({ runtime: copilotRuntime, basePath: '/api/copilotkit' });

export const GET = handler;
export const POST = handler;
