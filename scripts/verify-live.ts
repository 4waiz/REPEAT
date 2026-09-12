/**
 * Live integration self-test.
 *
 * `npm run verify` proves the engine with no network. This proves the two
 * live integrations against the real services, using the same fixtures:
 *
 *   - OpenRouter reads each report and the answer survives validation
 *   - the model agrees with the deterministic classifier on the three
 *     unambiguous bugs, and stops for review on the ambiguous one
 *   - Exa attaches related context, and only the symptom phrase leaves —
 *     never the customer's name, address or message body
 *   - a bad key degrades to the deterministic answer, never to an error
 *   - the live understanding flows through the same planner and still
 *     reroutes the frontend bug to Noor
 *
 * Needs OPENROUTER_API_KEY and EXA_API_KEY in .env. Costs a fraction of a
 * cent per run. Run with:  npm run verify:live
 */
import { BUG_1, BUG_2, BUG_3, BUG_4_AMBIGUOUS } from '@/lib/demo/fixtures';
import { understandLive, type LiveUnderstanding } from '@/lib/agents/understanding-live';
import { understandDeterministic } from '@/lib/agents/understanding';
import { composeIssueBody } from '@/lib/agents/compose';
import { buildTrace } from '@/lib/demo/trace-builder';
import { detect } from '@/lib/patterns/detector';
import { compilePattern } from '@/lib/patterns/compiler';
import { planRun } from '@/lib/agents/ghost-runner';
import { OWNER_CONFIDENCE_FLOOR } from '@/lib/demo/config';
import { llmConfig } from '@/lib/llm/openrouter';
import { exaApiKey } from '@/lib/research/exa';
import { formatPercent, hostnameOf } from '@/lib/utils';

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

function describe(name: string, live: LiveUnderstanding) {
  const { understanding: u, provenance: p } = live;
  console.log(`  ${name}: area=${u.area} category=${u.category} severity=${u.severity} conf=${formatPercent(u.confidence)}`);
  console.log(`         understood by: ${p.usedLlm ? `${p.model} via ${p.provider} (${p.llmLatencyMs}ms)` : `deterministic — ${p.fallbackReason}`}`);
  console.log(`         title: ${u.issueTitle}`);
  console.log(`         evidence: ${u.evidence.join(' | ')}`);
  if (p.researchQuery) console.log(`         research query: ${p.researchQuery}`);
  if (p.usedResearch) {
    console.log(`         references (${p.researchLatencyMs}ms):`);
    for (const r of u.references ?? []) console.log(`           - ${r.title}  [${hostnameOf(r.url)}]`);
  } else {
    console.log(`         references: none — ${p.researchReason}`);
  }
}

async function main() {
  const llm = llmConfig();
  const exa = exaApiKey();

  section('0. Configuration');
  console.log(`  model provider:     ${llm ? `${llm.provider}  model=${llm.model}${llm.fallbackModels.length ? ` fallbacks=${llm.fallbackModels.join(',')}` : ''}` : 'missing (set OPENROUTER_API_KEY or OPENAI_API_KEY)'}`);
  console.log(`  EXA_API_KEY:        ${exa ? 'set' : 'missing'}`);
  if (!llm && !exa) {
    console.log('\n  Nothing to test. Copy .env.example to .env and add OPENROUTER_API_KEY (or OPENAI_API_KEY / GEMINI_API_KEY) and EXA_API_KEY.');
    process.exit(1);
  }

  /* -------------------------------------------------------------------- */
  section('1. Live understanding of the four fixtures');

  const fixtures = [BUG_1, BUG_2, BUG_3, BUG_4_AMBIGUOUS];
  const results = await Promise.all(fixtures.map((m) => understandLive(m)));
  const [live1, live2, live3, live4] = results;

  describe('bug 1', live1);
  describe('bug 2', live2);
  describe('bug 3', live3);
  describe('bug 4', live4);

  /* -------------------------------------------------------------------- */
  section('2. OpenRouter');

  if (llm) {
    for (const [name, live] of [['bug 1', live1], ['bug 2', live2], ['bug 3', live3], ['bug 4', live4]] as const) {
      check(`${name} was read by the model`, live.provenance.usedLlm, live.provenance.fallbackReason ?? live.provenance.model);
    }
    check('model name is reported', results.every((r) => !r.provenance.usedLlm || Boolean(r.provenance.model)));
    check('bug 1 is backend', live1.understanding.area === 'backend', live1.understanding.area);
    check('bug 1 is authentication', live1.understanding.category === 'authentication', live1.understanding.category);
    check('bug 2 is backend', live2.understanding.area === 'backend', live2.understanding.area);
    check('bug 2 is performance', live2.understanding.category === 'performance', live2.understanding.category);
    check('bug 3 is frontend', live3.understanding.area === 'frontend', live3.understanding.area);
    check('bug 3 is ui', live3.understanding.category === 'ui', live3.understanding.category);
    check(
      'ambiguous bug 4 stops for review',
      live4.understanding.area === 'unresolved' || live4.understanding.confidence < OWNER_CONFIDENCE_FLOOR,
      `area=${live4.understanding.area} conf=${formatPercent(live4.understanding.confidence)}`,
    );
    check('customer name kept', live1.understanding.customerName.toLowerCase().includes('alex'), live1.understanding.customerName);
    check(
      'labels keep the observed convention (bug + category + area)',
      live3.understanding.labels.slice(0, 3).join(',') === 'bug,ui,frontend',
      live3.understanding.labels.join(','),
    );

    // Same rule the engine enforces: ignoring case, whitespace and quote
    // marks, the cited words must appear contiguously in the report.
    const flat = (text: string) =>
      text.toLowerCase().replace(/["'“”‘’]/g, '').replace(/\s+/g, ' ').trim();
    check(
      'every evidence phrase is a literal quote from its report',
      results.every((r, i) =>
        !r.provenance.usedLlm ||
        r.understanding.evidence.every((e) => flat(`${fixtures[i].subject}\n${fixtures[i].body}`).includes(flat(e))),
      ),
    );
    check(
      'answers within the demo ceiling',
      results.every((r) => (r.provenance.llmLatencyMs ?? 0) < 8000),
      `max ${Math.max(...results.map((r) => r.provenance.llmLatencyMs ?? 0))}ms`,
    );
  } else {
    console.log('  skipped — OPENROUTER_API_KEY not set');
  }

  /* -------------------------------------------------------------------- */
  section('3. Exa');

  if (exa) {
    for (const [name, live] of [['bug 1', live1], ['bug 2', live2], ['bug 3', live3]] as const) {
      check(`${name} has related context`, live.provenance.usedResearch, live.provenance.researchReason ?? `${live.provenance.referenceCount} refs`);
    }
    check('ambiguous bug 4 is not researched', !live4.provenance.usedResearch, live4.provenance.researchReason);
    check(
      'references have title, url and snippet',
      results.every((r) => (r.understanding.references ?? []).every((x) => x.title && /^https?:\/\//.test(x.url) && typeof x.snippet === 'string')),
    );

    // Privacy: the query is the symptom, not the person and not the message.
    for (const [name, live, m] of [['bug 1', live1, BUG_1], ['bug 2', live2, BUG_2], ['bug 3', live3, BUG_3]] as const) {
      const q = (live.provenance.researchQuery ?? '').toLowerCase();
      const first = m.from.split(' ')[0].toLowerCase();
      check(
        `${name} query carries no identity`,
        Boolean(q) && !q.includes(first) && !q.includes(m.fromEmail.toLowerCase()) && !q.includes('@'),
        live.provenance.researchQuery,
      );
      check(`${name} query is not the message body`, q.length < 200 && !q.includes(m.body.trim().slice(0, 40).toLowerCase()));
    }
  } else {
    console.log('  skipped — EXA_API_KEY not set');
  }

  /* -------------------------------------------------------------------- */
  section('4. Failure degrades, never errors');

  const broken = await understandLive(BUG_1, {
    env: { ...process.env, OPENROUTER_API_KEY: 'sk-or-invalid', EXA_API_KEY: 'invalid' },
    llmTimeoutMs: 8000,
    researchTimeoutMs: 6000,
  });
  const deterministic = understandDeterministic(BUG_1);
  console.log(`  bad keys -> understood by: ${broken.provenance.usedLlm ? 'model?!' : `deterministic (${broken.provenance.fallbackReason})`}`);
  console.log(`  bad keys -> research: ${broken.provenance.usedResearch ? 'refs?!' : `none (${broken.provenance.researchReason})`}`);
  check('bad model key falls back to the deterministic classifier', !broken.provenance.usedLlm && broken.understanding.source === 'deterministic');
  check('fallback is byte-identical to the deterministic answer', JSON.stringify(broken.understanding) === JSON.stringify(deterministic));
  check('bad research key attaches nothing', !broken.provenance.usedResearch && !broken.understanding.references);
  check('the reasons are stated', Boolean(broken.provenance.fallbackReason) && Boolean(broken.provenance.researchReason));

  /* -------------------------------------------------------------------- */
  section('5. The live understanding drives the same Ghost Run');

  const u1 = understandDeterministic(BUG_1);
  const u2 = understandDeterministic(BUG_2);
  const trace1 = buildTrace(BUG_1, u1, 'Observation 1');
  const trace2 = buildTrace(BUG_2, u2, 'Observation 2', { issueNumber: 43, variation: 'reread' });
  const detected = detect([trace1, trace2]);
  if (detected.kind !== 'pattern') throw new Error('detector did not find a pattern');
  const pattern = { ...compilePattern(detected.matched), status: 'active' as const };

  const run = planRun(pattern, BUG_3, live3.understanding, 44);
  const assign = run.proposedActions.find((a) => a.action === 'tracker.assign_owner');
  const create = run.proposedActions.find((a) => a.action === 'tracker.create_issue');
  console.log(`  trigger: ${run.triggerSummary}`);
  console.log(`  owner: ${String(assign?.resolvedParams.owner)}  risk=${run.risk} confidence=${formatPercent(run.confidence)}`);
  for (const ad of run.adaptations) console.log(`  adaptation: ${ad.field} ${ad.observedValue} -> ${ad.adaptedValue} (${ad.rule})`);

  check('run is a ghost, not approved', run.status === 'ghost' && !run.approved);
  check('frontend bug reroutes to Noor', assign?.resolvedParams.owner === 'Noor', String(assign?.resolvedParams.owner));
  check('adaptation recorded', run.adaptations.some((a) => a.field === 'owner' && a.adaptedValue === 'Noor'));
  if (live3.provenance.usedResearch) {
    const body = String(create?.resolvedParams.issueDescription);
    check('ticket body carries the related context', body.includes('Related context') && body.includes('https://'), `${body.split('\n').length} lines`);
    check('composeIssueBody matches the planned body', composeIssueBody(live3.understanding) === body);
  }
  check('Ghost Run shows the model, never its reasoning', !JSON.stringify(run).toLowerCase().includes('reasoning'));

  /* -------------------------------------------------------------------- */
  console.log(`\n${'='.repeat(52)}`);
  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
  console.log('live integrations OK');
}

main().catch((err) => {
  console.error('\nverify-live crashed:');
  console.error(err);
  process.exit(1);
});
