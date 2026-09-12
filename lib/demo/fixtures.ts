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
  body: `Hello support,

Since yesterday evening every call to the reports endpoint times out
after about 30 seconds and returns a 504. Smaller date ranges fail too,
so it doesn't look like a data volume problem.

Our nightly export job depends on this endpoint and it has now failed
twice in a row.

Please advise.

Priya
Northwind Analytics`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-2-timeout',
};

export const BUG_3: MailMessage = {
  id: 'mail_bug_3',
  from: 'Daniel Okafor',
  fromEmail: 'daniel.okafor@brightloop.co',
  subject: 'Navigation bar is broken on mobile',
  body: `Hi,

On my phone the top navigation bar overlaps the page heading and the menu
button does nothing when tapped. The dropdown renders off screen, so I
can't reach Settings at all.

It looks fine on desktop Chrome - only the mobile layout is affected.

Screenshot attached.

Daniel`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-3-navbar',
};

/**
 * A deliberately ambiguous report. Nothing in it identifies an engineering
 * area, so the classifier cannot route it confidently and the Ghost Run must
 * stop and ask. Kept out of the main sequence and reachable from the demo
 * console, because a product that can only demo its happy path is not one.
 */
export const BUG_4_AMBIGUOUS: MailMessage = {
  id: 'mail_bug_4',
  from: 'Mara Feld',
  fromEmail: 'mara@lighthouse-partners.com',
  subject: 'Something went wrong yesterday',
  body: `Hi,

Yesterday afternoon a few things did not behave the way we expected while we
were preparing the quarterly pack. It sorted itself out later but my colleague
saw it too, so I wanted to flag it.

Happy to jump on a call if that is easier.

Mara`,
  receivedAt: '',
  read: false,
  fixtureRef: 'bug-4-ambiguous',
};

/** Ordered: two training observations, then the generalization test. */
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
export const START_CHANNEL = 'engineering';

export const CHAT_CHANNELS = [
  { name: 'product-updates', unread: 2, active: false },
  { name: 'engineering', unread: 0, active: true },
  { name: 'support', unread: 5, active: false },
  { name: 'bugs', unread: 1, active: false },
  { name: 'releases', unread: 0, active: false },
];

export const TRACKER_PROJECT = {
  org: 'team-kanban',
  repo: 'product',
  label: 'team-kanban/product',
};
