/**
 * Names shared between the CopilotKit runtime route (server) and the Ghost
 * Run bridge (browser). The `ghost` agent is REPEAT's planner exposed over
 * AG-UI; these are the tool calls it streams.
 */
export const GHOST_AGENT_ID = 'ghost';
/** One per proposed action, in plan order; args = PlannedAction. */
export const GHOST_TOOL_ACTION = 'proposeAction';
/** Once, at the end; args = { run: AgentRun, provenance: UnderstandingProvenance }. */
export const GHOST_TOOL_RUN = 'proposeRun';
/** Agent-context keys the browser shares; values are JSON strings. */
export const GHOST_CONTEXT_REPORT = 'report';
export const GHOST_CONTEXT_PATTERN = 'pattern';
