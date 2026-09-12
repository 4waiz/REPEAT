'use client';

import * as React from 'react';
import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import { GHOST_AGENT_ID } from '@/lib/agents/ghost-agent';
import { DEMO_MODE } from '@/lib/demo/config';
import { GhostRunBridge } from './GhostRunBridge';

/**
 * Mounts CopilotKit's self-hosted runtime client in live mode only.
 *
 * No chat component is rendered and no styles are imported: the provider is
 * the AG-UI transport for the `ghost` agent — REPEAT's planner — and the
 * bridge below turns its streamed tool calls into REPEAT's own Ghost Run.
 * In Demo Mode this is a pass-through: the provider would call
 * /api/copilotkit/info on mount, and Demo Mode makes no requests.
 */
export function CopilotShell({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) return <>{children}</>;
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      agentId={GHOST_AGENT_ID}
      showDevConsole={false}
      enableInspector={false}
    >
      <GhostRunBridge />
      {children}
    </CopilotKitProvider>
  );
}
