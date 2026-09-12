/**
 * Real-surface credential check — Gmail, Jira, ClickUp.
 *
 * For each connector that has credentials in .env, one or two read-only
 * calls prove they work and print what REPEAT would see. Nothing is written
 * unless you pass --create, which files one real "REPEAT verification"
 * issue in the Jira project and assigns it to the token owner.
 *
 *   npm run verify:surfaces
 *   npm run verify:surfaces -- --create
 */
import { fetchRecentMail, gmailConfig } from '@/lib/mail/gmail';
import { JiraIssueTrackerAdapter, jiraConfig } from '@/lib/adapters/jira';
import { ClickUpIssueTrackerAdapter, clickUpConfig } from '@/lib/adapters/clickup';

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

const create = process.argv.includes('--create');

async function main() {
  let any = false;

  section('Gmail (IMAP, app password)');
  const gmail = gmailConfig();
  if (!gmail) {
    console.log('  skipped — GMAIL_ADDRESS / GMAIL_APP_PASSWORD not set');
  } else {
    any = true;
    try {
      const started = Date.now();
      const messages = await fetchRecentMail(gmail, { limit: 10, sinceDays: 30 });
      console.log(`  ${gmail.address}: ${messages.length} recent messages in ${Date.now() - started}ms`);
      for (const m of messages.slice(0, 5)) {
        console.log(`    ${m.read ? ' ' : '*'} ${m.receivedAt.slice(0, 16)}  ${m.from} <${m.fromEmail}>  ${m.subject.slice(0, 60)}  (${m.body.length} chars)`);
      }
      check('inbox readable', true);
      check('messages carry a plain-text body', messages.every((m) => typeof m.body === 'string'));
    } catch (error) {
      check('inbox readable', false, error instanceof Error ? error.message : String(error));
    }
  }

  section('Jira Cloud');
  const jira = jiraConfig();
  if (!jira) {
    console.log('  skipped — JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN / JIRA_PROJECT_KEY not set');
  } else {
    any = true;
    const adapter = new JiraIssueTrackerAdapter(jira);
    try {
      const me = await adapter.whoAmI();
      console.log(`  ${jira.baseUrl} as ${me.displayName ?? me.emailAddress} (${me.accountId})`);
      check('credentials accepted', Boolean(me.accountId));
      const issues = await adapter.listIssues(5);
      console.log(`  project ${jira.projectKey}: ${issues.length} recent issues`);
      for (const i of issues) console.log(`    ${i.key}  ${i.title.slice(0, 60)}  [${i.priority}] ${i.assignee ?? 'unassigned'}`);
      check('project searchable', true);
      for (const owner of ['Noor', 'Umar', 'Awaiz', 'Huda', 'Obaid']) {
        const user = await adapter.resolveAssignee(owner);
        console.log(`    ${owner.padEnd(6)} -> ${user ? `${user.displayName} (${user.accountId})` : 'no assignable user (add JIRA_ASSIGNEES)'}`);
      }
      if (create) {
        const created = await adapter.createIssue({
          title: 'REPEAT verification — safe to delete',
          body: 'Created by npm run verify:surfaces --create to prove the Jira adapter.\n\nLabels, priority and assignment are exercised below.',
          labels: ['repeat-verification'],
          priority: 'low',
        });
        console.log(`  ${created.summary}${created.error ? ` — ${created.error}` : ''}`);
        check('issue created', created.ok, created.error);
        if (created.ok) {
          const assigned = await adapter.assignIssue({ number: 0, id: String(created.data?.id) }, me.displayName ?? 'me');
          console.log(`  ${assigned.summary}${assigned.error ? ` — ${assigned.error}` : ''}`);
          check('issue assigned to the token owner', assigned.ok, assigned.error);
          console.log(`  -> ${String(created.data?.url)}`);
        }
      } else {
        console.log('  (pass --create to file one real verification issue)');
      }
    } catch (error) {
      check('Jira reachable', false, error instanceof Error ? error.message : String(error));
    }
  }

  section('ClickUp');
  const clickUp = clickUpConfig();
  if (!clickUp) {
    console.log('  skipped — CLICKUP_API_KEY / CLICKUP_LIST_ID not set');
  } else {
    any = true;
    const adapter = new ClickUpIssueTrackerAdapter(clickUp);
    try {
      const tasks = await adapter.listTasks(5);
      console.log(`  list ${clickUp.listId}: ${tasks.length} recent tasks`);
      for (const t of tasks) console.log(`    ${t.key}  ${t.title.slice(0, 60)}  [${t.priority}] ${t.assignee ?? 'unassigned'}`);
      check('list readable', true);
      const members = await adapter.members();
      console.log(`  members: ${members.map((m) => `${m.username} (${m.id})`).join(', ')}`);
      for (const owner of ['Noor', 'Umar', 'Awaiz', 'Huda', 'Obaid']) {
        const member = await adapter.resolveAssignee(owner);
        console.log(`    ${owner.padEnd(6)} -> ${member ? `${member.username} (${member.id})` : 'no member (add CLICKUP_ASSIGNEES)'}`);
      }
    } catch (error) {
      check('ClickUp reachable', false, error instanceof Error ? error.message : String(error));
    }
  }

  if (!any) {
    console.log('\n  Nothing configured. See docs/KEYS.md.');
    process.exit(1);
  }
  console.log(`\n${'='.repeat(52)}`);
  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
  console.log('surfaces OK');
}

main().catch((err) => {
  console.error('\nverify-surfaces crashed:');
  console.error(err);
  process.exit(1);
});
