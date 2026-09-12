'use client';

import * as React from 'react';
import { useAgent, useAgentContext, useCopilotKit } from '@copilotkit/react-core/v2';
import type { AgentRun } from '@/types';
import type { UnderstandingProvenance } from '@/lib/agents/understanding-live';
import {
  GHOST_AGENT_ID,
  GHOST_CONTEXT_PATTERN,
  GHOST_CONTEXT_REPORT,
  GHOST_TOOL_ACTION,
  GHOST_TOOL_RUN,
} from '@/lib/agents/ghost-agent';
import { setLivePlanner, useRepeat } from '@/lib/store/repeat-store';

/**
 * The bridge between REPEAT's store and the `ghost` AG-UI agent.
 *
 * When a learned trigger fires, the store asks the registered planner for the
 * Ghost Run. This planner runs the agent through CopilotKit: the report, the
 * learned pattern and the next issue number go up as run input, and the plan
 * comes back as a stream of `proposeAction` tool calls followed by one
 * `proposeRun`. Each arriving action ticks the progress banner; the final
 * run replaces the deterministic plan before the Ghost Run opens.
 *
 * Nothing here is a prompt. If the stream fails or stalls, the planner
 * resolves null and the store falls back to the REST pass, then to the
 * deterministic plan.
 */

/** Ceiling on a streamed plan; the model and research passes are ~8s. */
const STREAM_TIMEOUT_MS = 20_000;

export function GhostRunBridge() {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId: GHOST_AGENT_ID });

  // Share what REPEAT is looking at as agent context, for inspection and for
  // any tool that wants it. The run itself carries the same data explicitly.
  const selectedMailId = useRepeat((s) => s.selectedMailId);
  const inbox = useRepeat((s) => s.inbox);
  const patterns = useRepeat((s) => s.patterns);
  const report = inbox.find((m) => m.id === selectedMailId) ?? null;
  const pattern = patterns.find((p) => p.status === 'active') ?? null;
  useAgentContext({ description: GHOST_CONTEXT_REPORT, value: report ? JSON.stringify(report) : '' });
  useAgentContext({ description: GHOST_CONTEXT_PATTERN, value: pattern ? JSON.stringify(pattern) : '' });

  React.useEffect(() => {
    setLivePlanner(async ({ message, pattern: learned, issueNumber, onProgress }) => {
      let run: AgentRun | null = null;
      let provenance: UnderstandingProvenance | null = null;
      let arrived = 0;

      const subscription = agent.subscribe({
        onToolCallEndEvent: ({ toolCallName, toolCallArgs }) => {
          if (toolCallName === GHOST_TOOL_ACTION) {
            arrived += 1;
            onProgress?.(arrived);
          } else if (toolCallName === GHOST_TOOL_RUN) {
            const args = toolCallArgs as { run?: AgentRun; provenance?: UnderstandingProvenance };
            run = args.run ?? null;
            provenance = args.provenance ?? null;
          }
        },
      });

      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), STREAM_TIMEOUT_MS));
      try {
        await Promise.race([
          copilotkit.runAgent({
            agent,
            forwardedProps: {
              [GHOST_CONTEXT_REPORT]: JSON.stringify(message),
              [GHOST_CONTEXT_PATTERN]: JSON.stringify(learned),
              issueNumber,
            },
          }),
          timeout,
        ]);
      } catch {
        return null;
      } finally {
        subscription.unsubscribe();
      }

      if (!run || !provenance) return null;
      return { run, provenance, transport: 'CopilotKit (AG-UI)' };
    });
    return () => setLivePlanner(null);
  }, [agent, copilotkit]);

  return null;
}
