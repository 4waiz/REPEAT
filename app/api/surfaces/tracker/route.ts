import { NextResponse } from 'next/server';
import type { TrackerSurface } from '@/types';
import { DEMO_MODE } from '@/lib/demo/config';
import { ClickUpIssueTrackerAdapter, clickUpConfig } from '@/lib/adapters/clickup';
import { JiraIssueTrackerAdapter, jiraConfig } from '@/lib/adapters/jira';

/**
 * The real boards, read-only.
 *
 * In live mode the tracker window shows the actual list REPEAT files into —
 * ClickUp, Jira — instead of the replica. This route reads each configured
 * tracker and returns its recent issues in REPEAT's own shape. Nothing is
 * written here; writes only ever go through POST /api/execute.
 */

export const runtime = 'nodejs';

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({ error: 'Demo Mode is on. Real boards are not read.' }, { status: 409 });
  }

  const surfaces: TrackerSurface[] = [];

  const clickUp = clickUpConfig();
  if (clickUp) {
    const adapter = new ClickUpIssueTrackerAdapter(clickUp);
    try {
      surfaces.push({
        provider: 'clickup',
        target: `ClickUp list ${clickUp.listId}`,
        url: `https://app.clickup.com/${clickUp.teamId ?? ''}/v/li/${clickUp.listId}`,
        issues: await adapter.listTasks(30),
      });
    } catch (error) {
      surfaces.push({ provider: 'clickup', target: `ClickUp list ${clickUp.listId}`, issues: [], error: String(error) });
    }
  }

  const jira = jiraConfig();
  if (jira) {
    const adapter = new JiraIssueTrackerAdapter(jira);
    try {
      surfaces.push({
        provider: 'jira',
        target: `Jira · ${jira.projectKey}`,
        url: `${jira.baseUrl}/browse/${jira.projectKey}`,
        issues: await adapter.listIssues(30),
      });
    } catch (error) {
      surfaces.push({ provider: 'jira', target: `Jira · ${jira.projectKey}`, issues: [], error: String(error) });
    }
  }

  return NextResponse.json({ trackers: surfaces });
}
