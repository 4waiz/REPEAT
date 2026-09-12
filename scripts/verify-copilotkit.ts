/**
 * CopilotKit / AG-UI integration self-test.
 *
 * Against a running dev server in live mode (DEMO_MODE=false, model keys in
 * .env), this proves the Ghost Run is really served over AG-UI:
 *
 *   - GET  /api/copilotkit/info lists the `ghost` agent
 *   - POST /api/copilotkit/agent/ghost/run with the third bug and a pattern
 *     compiled offline streams RUN_STARTED, one proposeAction per planned
 *     step, one proposeRun carrying the whole run, then RUN_FINISHED
 *   - the streamed run is the same plan the REST path makes: the frontend
 *     bug is rerouted to Noor, and the model's provenance travels with it
 *
 * One model + research call (a few cents). Run with:
 *   npm run dev            (in another terminal)
 *   npm run verify:copilotkit
 */
import { BUG_1, BUG_2, BUG_3 } from '@/lib/demo/fixtures';
import { understandDeterministic } from '@/lib/agents/understanding';
import { buildTrace } from '@/lib/demo/trace-builder';
import { detect } from '@/lib/patterns/detector';
import { compilePattern } from '@/lib/patterns/compiler';
import {
  GHOST_AGENT_ID,
  GHOST_CONTEXT_PATTERN,
  GHOST_CONTEXT_REPORT,
  GHOST_TOOL_ACTION,
  GHOST_TOOL_RUN,
} from '@/lib/agents/ghost-agent';
import type { AgentRun } from '@/types';

const BASE = (process.env.REPEAT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: string) {
  checks += 1;
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!condition) failures += 1;
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

type SseEvent = { type: string; toolCallName?: string; toolCallId?: string; delta?: string; message?: string };

function parseSse(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as SseEvent);
    } catch {
      // keep-alive or partial line
    }
  }
  return events;
}

async function main() {
  section('1. Runtime discovery');
  const info = await fetch(`${BASE}/api/copilotkit/info`);
  check('GET /api/copilotkit/info answers', info.ok, String(info.status));
  const infoBody = (await info.json()) as { version?: string; agents?: Record<string, unknown>; mode?: string };
  console.log(`  runtime ${infoBody.version} · mode ${infoBody.mode} · agents ${Object.keys(infoBody.agents ?? {}).join(', ')}`);
  check(`agent "${GHOST_AGENT_ID}" is registered`, Boolean(infoBody.agents?.[GHOST_AGENT_ID]));

  section('2. Plan input (offline)');
  const detected = detect([
    buildTrace(BUG_1, understandDeterministic(BUG_1), 'Observation 1'),
    buildTrace(BUG_2, understandDeterministic(BUG_2), 'Observation 2', { issueNumber: 43, variation: 'reread' }),
  ]);
  if (detected.kind !== 'pattern') throw new Error('detector did not find a pattern');
  const pattern = { ...compilePattern(detected.matched), status: 'active' as const };
  const report = { ...BUG_3, receivedAt: new Date().toISOString(), read: true };
  const expectedSteps = 9;

  section('3. Stream the Ghost Run over AG-UI');
  const started = Date.now();
  const response = await fetch(`${BASE}/api/copilotkit/agent/${GHOST_AGENT_ID}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({
      threadId: `verify-${Date.now()}`,
      runId: `verify-run-${Date.now()}`,
      state: {},
      messages: [],
      tools: [],
      context: [],
      forwardedProps: {
        [GHOST_CONTEXT_REPORT]: JSON.stringify(report),
        [GHOST_CONTEXT_PATTERN]: JSON.stringify(pattern),
        issueNumber: 44,
      },
    }),
  });
  check('POST /agent/ghost/run answers 200', response.ok, String(response.status));
  check('response is an event stream', (response.headers.get('content-type') ?? '').includes('text/event-stream'), response.headers.get('content-type') ?? '');

  const events = parseSse(await response.text());
  const types = events.map((e) => e.type);
  const toolNames = events.filter((e) => e.type === 'TOOL_CALL_START').map((e) => e.toolCallName);
  console.log(`  ${events.length} events in ${Date.now() - started}ms: ${[...new Set(types)].join(', ')}`);
  console.log(`  tool calls: ${toolNames.join(', ')}`);

  check('run started and finished', types[0] === 'RUN_STARTED' && types[types.length - 1] === 'RUN_FINISHED');
  check('no run error', !types.includes('RUN_ERROR'), events.find((e) => e.type === 'RUN_ERROR')?.message);
  check(`${expectedSteps} proposeAction tool calls`, toolNames.filter((n) => n === GHOST_TOOL_ACTION).length === expectedSteps, String(toolNames.length));
  check('exactly one proposeRun', toolNames.filter((n) => n === GHOST_TOOL_RUN).length === 1);

  // Reassemble the proposeRun args from its TOOL_CALL_ARGS deltas.
  const runStart = events.find((e) => e.type === 'TOOL_CALL_START' && e.toolCallName === GHOST_TOOL_RUN);
  const runArgs = events
    .filter((e) => e.type === 'TOOL_CALL_ARGS' && e.toolCallId === runStart?.toolCallId)
    .map((e) => e.delta ?? '')
    .join('');
  const payload = JSON.parse(runArgs) as { run: AgentRun; provenance: { usedLlm: boolean; model?: string; usedResearch: boolean; referenceCount: number } };
  const assign = payload.run.proposedActions.find((a) => a.action === 'tracker.assign_owner');
  console.log(`  run: ${payload.run.proposedActions.length} actions · owner ${String(assign?.resolvedParams.owner)} · model ${payload.provenance.model ?? 'deterministic'} · refs ${payload.provenance.referenceCount}`);

  check('streamed run is a ghost, not approved', payload.run.status === 'ghost' && !payload.run.approved);
  check('frontend bug reroutes to Noor', assign?.resolvedParams.owner === 'Noor', String(assign?.resolvedParams.owner));
  check('adaptation recorded', payload.run.adaptations.some((a) => a.field === 'owner' && a.adaptedValue === 'Noor'));
  check('provenance travels with the run', typeof payload.provenance.usedLlm === 'boolean' && typeof payload.provenance.referenceCount === 'number');
  check('no text message, no prompt — only tool calls', !types.some((t) => t.startsWith('TEXT_MESSAGE')));

  console.log(`\n${'='.repeat(52)}`);
  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
  console.log('copilotkit OK');
}

main().catch((err) => {
  console.error('\nverify-copilotkit crashed (is `npm run dev` running in live mode?):');
  console.error(err);
  process.exit(1);
});
