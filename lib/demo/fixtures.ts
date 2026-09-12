import type { ChatMessage, MailMessage, TrackerIssue } from '@/types';

/**
 * Demo fixtures.
 *
 * Three real-looking support emails. The first two teach the workflow; the
 * third is deliberately a *different engineering area* so the audience can
 * see REPEAT reclassify and reroute rather than replay.
 *
 * Nothing in these fixtures tells the engine the answer — there is no
 * `expectedArea` field. Classification is derived from the text every time.
 */

export const BUG_1: MailMessage = {
  id: 'mail_bug_1',
  from: 'Alex Chen',
  fromEmail: 'alex.chen@acmecorp.com',
  subject: "Login issue - can't access account",
  body: `Hi team,

I'm unable to log in to my account since this morning.
I keep receiving an "Invalid credentials" error even though
my password is correct.

This is blocking me from accessing the dashboard.

Can someone take a look?

Thanks,
Alex`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-1-auth',
};

export const BUG_2: MailMessage = {
  id: 'mail_bug_2',
  from: 'Priya Raman',
  fromEmail: 'priya.raman@northwind.io',
  subject: 'Reports API timing out on every request',
  body: `Hello,

Every call to the reports endpoint times out. We get an HTTP 504 after
about thirty seconds, on every request, since yesterday afternoon.

This is blocking our nightly export job.

Priya`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-2-timeout',
};

export const BUG_3: MailMessage = {
  id: 'mail_bug_3',
  from: 'Daniel Okafor',
  fromEmail: 'daniel.okafor@brightlane.co',
  subject: 'Charged twice for my subscription this month',
  body: `Hi,

I have been billed twice for my subscription this month. There are two
identical payments on my card three days apart, and only one invoice in
my account.

Could you refund the duplicate charge?

Daniel`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-3-billing',
};

export const BUG_4_AMBIGUOUS: MailMessage = {
  id: 'mail_bug_4',
  from: 'Mara Feld',
  fromEmail: 'mara.feld@lumenworks.com',
  subject: 'Something went wrong yesterday',
  body: `Hey,

Something was off yesterday afternoon. It seemed to sort itself out but
I wanted to flag it in case it matters.

Mara`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-4-ambiguous',
};

export const BUG_FIXTURES = [BUG_1, BUG_2, BUG_3, BUG_4_AMBIGUOUS];

/**
 * Inbox noise. Present so the mail window looks like a real inbox and so the
 * trigger classifier has to actually discriminate support bugs from the rest.
 */
export const INBOX_NOISE: MailMessage[] = [
  {
    id: 'mail_noise_1',
    from: 'Figma',
    fromEmail: 'updates@figma.com',
    subject: 'Kanban Studio - 3 new comments on Dashboard v4',
    body: 'Noor left 3 comments on Dashboard v4.',
    receivedAt: '',
    read: true,
    fixtureRef: 'noise',
  },
  {
    id: 'mail_noise_2',
    from: 'Obaid',
    fromEmail: 'obaid@teamkanban.dev',
    subject: 'Re: sprint review moved to Thursday',
    body: 'Moving sprint review to Thursday 4pm so everyone can make it.',
    receivedAt: '',
    read: true,
    fixtureRef: 'noise',
  },
  {
    id: 'mail_noise_3',
    from: 'Vercel',
    fromEmail: 'notifications@vercel.com',
    subject: 'Deployment ready - kanban-web (production)',
    body: 'Your deployment is live.',
    receivedAt: '',
    read: true,
    fixtureRef: 'noise',
  },
];

/** Issues that predate the session, so the tracker is not an empty shell. */
export const SEED_ISSUES: TrackerIssue[] = [
  {
    id: 'issue_seed_1',
    number: 39,
    title: 'Empty state missing on saved views',
    body: 'Saved views with no results render a blank panel.',
    labels: ['bug', 'ui'],
    priority: 'low',
    assignee: 'Noor',
    createdAt: '',
    createdBy: 'human',
    state: 'open',
  },
  {
    id: 'issue_seed_2',
    number: 40,
    title: 'Rate limit headers missing on /v2/events',
    body: 'Clients cannot back off correctly without the headers.',
    labels: ['bug', 'integration'],
    priority: 'medium',
    assignee: 'Umar',
    createdAt: '',
    createdBy: 'human',
    state: 'open',
  },
  {
    id: 'issue_seed_3',
    number: 41,
    title: 'Retraining job writes duplicate feature rows',
    body: 'Duplicate rows appear when the job retries a shard.',
    labels: ['bug', 'data'],
    priority: 'high',
    assignee: 'Awaiz',
    createdAt: '',
    createdBy: 'human',
    state: 'open',
  },
];

/** The number the next created issue receives. */
export const FIRST_ISSUE_NUMBER = 42;

export const SEED_CHAT: ChatMessage[] = [
  {
    id: 'chat_seed_1',
    channel: 'product-updates',
    author: 'Obaid',
    body: 'Sprint review moved to Thursday 4pm - calendar updated.',
    at: '',
    sentBy: 'human',
  },
  {
    id: 'chat_seed_2',
    channel: 'product-updates',
    author: 'Noor',
    body: 'Dashboard v4 is in review, comments welcome before Wednesday.',
    at: '',
    sentBy: 'human',
  },
  {
    id: 'chat_seed_3',
    channel: 'engineering',
    author: 'Umar',
    body: 'Deployed the rate-limit fix to staging, watching error rates.',
    at: '',
    sentBy: 'human',
  },
  {
    id: 'chat_seed_4',
    channel: 'engineering',
    author: 'Awaiz',
    body: 'Feature store backfill finished - numbers look right now.',
    at: '',
    sentBy: 'human',
  },
];

/** Where the user happens to be when the demo starts. */
export const START_CHANNEL = 'all-repeat-co';

/**
 * The desks REPEAT can announce into. These mirror the real Slack channels
 * one-for-one — see DEFAULT_AREA_CHANNELS in lib/demo/team.ts — so the window
 * on screen is the workspace the notification actually lands in.
 */
export const CHAT_CHANNELS = [
  { name: 'all-repeat-co', unread: 0, active: true },
  { name: 'billing-finance', unread: 0, active: false },
  { name: 'technical-support', unread: 0, active: false },
  { name: 'sales-accounts', unread: 0, active: false },
  { name: 'logistics-shipping', unread: 0, active: false },
  { name: 'product-rnd', unread: 0, active: false },
  { name: 'legal-compliance', unread: 0, active: false },
];

export const TRACKER_PROJECT = {
  org: 'team-kanban',
  repo: 'product',
  label: 'team-kanban/product',
};
