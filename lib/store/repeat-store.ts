'use client';

import { create } from 'zustand';
import type {
  AgentRun,
  ChatMessage,
  ComposerState,
  IssueSeverity,
  IssueUnderstanding,
  LearnedPattern,
  MailMessage,
  OrbState,
  SemanticAction,
  SemanticEvent,
  SourceApp,
  StagePhase,
  TimelineEntry,
  TrackerIssue,
  TrackerSurface,
  WorkflowTrace,
} from '@/types';
import { inferenceFor, normalize } from '@/lib/events/normalizer';
import { specFor } from '@/lib/events/taxonomy';
import { detect, liveConfidence } from '@/lib/patterns/detector';
import { compilePattern } from '@/lib/patterns/compiler';
import { understandDeterministic } from '@/lib/agents/understanding';
import { requestUnderstanding } from '@/lib/agents/understand-client';
import { providerLabel } from '@/lib/llm/openrouter';
import type { LiveUnderstanding, UnderstandingProvenance } from '@/lib/agents/understanding-live';
import { planRun, applyOwnerOverride } from '@/lib/agents/ghost-runner';
import { executeRun, verifyRun } from '@/lib/agents/executor';
import { DemoIssueTrackerAdapter, DemoMessagingAdapter, type FailurePoint } from '@/lib/adapters/demo';
import { RemoteIssueTrackerAdapter, RemoteMessagingAdapter } from '@/lib/adapters/remote';
import { startExtensionFeed } from './extension-feed';
import { DEFAULT_CHANNEL, composeTeamMessage } from '@/lib/agents/compose';
import {
  BUG_FIXTURES,
  CHAT_CHANNELS,
  FIRST_ISSUE_NUMBER,
  INBOX_NOISE,
  SEED_CHAT,
  SEED_ISSUES,
  START_CHANNEL,
} from '@/lib/demo/fixtures';
import { DEMO_MODE, TIMING } from '@/lib/demo/config';
import { routeOwner } from '@/lib/demo/team';
import { makeId, resetIdCounter, sleep } from '@/lib/utils';
import { playCue } from '@/lib/sound/cues';

/**
 * The live engine state.
 *
 * Everything the interface renders is derived from here, and every state
 * transition goes through the same pipeline the headless self-test exercises.
 * There is no second, "demo-only" code path.
 */

/** How often the connected inbox is re-read in live mode. */
const MAIL_POLL_MS = 20_000;

/** The clicks a human actually makes, in order. Drives the guide affordance. */
export const OBSERVABLE_SEQUENCE: SemanticAction[] = [
  'mail.read_message',
  'mail.copy_content',
  'tracker.open_composer',
  'tracker.compose_issue',
  'tracker.apply_labels',
  'tracker.set_priority',
  'tracker.assign_owner',
  'tracker.create_issue',
  'chat.open_channel',
  'chat.compose_message',
  'chat.notify_team',
];

type Metrics = {
  runs: number;
  successfulRuns: number;
  manualActionsAvoided: number;
  timeSavedSeconds: number;
  humanInterventions: number;
};

export type LiveTargets = {
  tracker: { name: string; live: boolean; target: string } | null;
  messaging: { name: string; live: boolean; target: string } | null;
};

/**
 * A planner that can replace the REST live pass: given the report, the
 * pattern and the next issue number, it returns a fully planned run plus
 * the provenance of the understanding behind it — or null to fall back.
 * The CopilotKit bridge registers one that streams the plan over AG-UI.
 */
export type LivePlanner = (input: {
  message: MailMessage;
  pattern: LearnedPattern;
  issueNumber: number;
  /** Progress callback: how many proposed actions have arrived so far. */
  onProgress?: (count: number) => void;
}) => Promise<{ run: AgentRun; provenance: UnderstandingProvenance; transport: string } | null>;

let livePlanner: LivePlanner | null = null;

/** Register (or clear) the streaming planner. Only the live bridge calls this. */
export function setLivePlanner(planner: LivePlanner | null) {
  livePlanner = planner;
}

type Settings = {
  soundOn: boolean;
  /** Subtle next-step hint ring during observation. */
  guideOn: boolean;
  observationPaused: boolean;
  excludedApps: string[];
};

export type RepeatState = {
  ready: boolean;
  phase: StagePhase;
  orb: OrbState;

  // observation
  traces: WorkflowTrace[];
  activeTrace: WorkflowTrace | null;
  confidence: number;
  /** Highest confidence seen — never moves backwards in the UI. */
  confidencePeak: number;

  // learning
  patterns: LearnedPattern[];
  collapsing: boolean;

  // runs
  runs: AgentRun[];
  activeRun: AgentRun | null;
  runningIndex: number;

  // replica apps
  inbox: MailMessage[];
  selectedMailId: string | null;
  clipboard: string | null;
  understanding: IssueUnderstanding | null;
  composer: ComposerState;
  issues: TrackerIssue[];
  nextIssueNumber: number;
  chat: ChatMessage[];
  activeChannel: string;
  chatDraft: string;

  timeline: TimelineEntry[];
  metrics: Metrics;
  settings: Settings;
  failAt: FailurePoint;
  banner: { kind: 'trigger' | 'error' | 'info'; text: string } | null;
  /** Index into BUG_FIXTURES for the next email the demo should deliver. */
  deliveredCount: number;
  /**
   * What live execution would touch, as reported by GET /api/execute. Null in
   * Demo Mode and until the first fetch. A null `tracker` in live mode means
   * no tracker is configured and the replica tracker stays in charge.
   */
  live: LiveTargets | null;
  /** The real boards (ClickUp, Jira) read in live mode; null in Demo Mode. */
  surfaces: { trackers: TrackerSurface[] } | null;
  /** The connected inbox in live mode; null when the replica inbox is in use. */
  mailSurface: { provider: 'gmail'; address: string } | null;
  /** Which real board the tracker window shows when more than one is configured. */
  trackerView: TrackerSurface['provider'] | null;

  // ---- lifecycle -------------------------------------------------------
  init: () => void;
  reset: () => void;

  // ---- observation (the human working) ---------------------------------
  observe: (action: SemanticAction, data?: Record<string, unknown>) => void;
  /** Add a message to the inbox (real mail connector, or the extension). No-op if present. */
  receiveMail: (message: MailMessage) => void;
  readMail: (id: string) => void;
  copyMail: () => void;
  openComposer: () => void;
  pasteIntoComposer: () => void;
  toggleLabel: (label: string) => void;
  setPriority: (p: IssueSeverity) => void;
  setAssignee: (name: string) => void;
  submitIssue: () => void;
  openChannel: (channel: string) => void;
  draftTeamMessage: () => void;
  sendTeamMessage: () => void;

  // ---- learning --------------------------------------------------------
  completeTrace: () => void;
  approvePattern: () => void;
  showPatternFirst: () => void;

  // ---- runs ------------------------------------------------------------
  deliverNextBug: () => void;
  deliverBug: (index: number) => void;
  /** A message arrived (fixture or real). Triggers a run when a pattern is active. */
  deliverMessage: (message: MailMessage) => void;
  openGhostRun: () => void;
  approveAndExecute: () => Promise<void>;
  cancelRun: () => void;
  resolveOwner: (owner: string) => void;
  retryRun: () => Promise<void>;

  // ---- settings / demo -------------------------------------------------
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Re-read the real boards (live mode). */
  refreshSurfaces: () => Promise<void>;
  setTrackerView: (provider: TrackerSurface['provider']) => void;
  setFailAt: (p: FailurePoint) => void;
  forgetPattern: (id: string) => void;
  setPatternStatus: (id: string, status: LearnedPattern['status']) => void;
  clearHistory: () => void;
  runObservationInstantly: (index: number) => void;
};

const emptyComposer: ComposerState = {
  open: false,
  title: '',
  body: '',
  labels: [],
  priority: '',
  assignee: '',
  touched: [],
};

function stamp(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function initialInbox(): MailMessage[] {
  return [
    { ...BUG_FIXTURES[0], receivedAt: stamp(3) },
    ...INBOX_NOISE.map((m, i) => ({ ...m, receivedAt: stamp(28 + i * 24) })),
  ];
}

function initialIssues(): TrackerIssue[] {
  return SEED_ISSUES.map((issue, i) => ({ ...issue, createdAt: stamp(180 + i * 90) }));
}

function initialChat(): ChatMessage[] {
  return SEED_CHAT.map((m, i) => ({ ...m, at: stamp(95 + i * 40) }));
}

const initialMetrics: Metrics = {
  runs: 0,
  successfulRuns: 0,
  manualActionsAvoided: 0,
  timeSavedSeconds: 0,
  humanInterventions: 0,
};

export const useRepeat = create<RepeatState>((set, get) => {
  /* -------------------------------------------------------------------- */
  /* helpers                                                              */
  /* -------------------------------------------------------------------- */

  const pushTimeline = (entry: Omit<TimelineEntry, 'id' | 'at'> & { at?: string }) => {
    set((s) => ({
      timeline: [
        ...s.timeline,
        { id: makeId('tl'), at: entry.at ?? new Date().toISOString(), ...entry },
      ],
    }));
  };

  /** Mark the most recent active timeline entry as done. */
  const settleTimeline = () => {
    set((s) => ({
      timeline: s.timeline.map((t) => (t.status === 'active' ? { ...t, status: 'done' } : t)),
    }));
  };

  const cue = (name: Parameters<typeof playCue>[0]) => {
    if (get().settings.soundOn) playCue(name);
  };

  /**
   * Live mode: the Mail window is the connected Gmail inbox. The first load
   * replaces the replica inbox; later polls add what is new, and a new,
   * unread support report fires the trigger — a real email starts the run.
   */
  const loadMail = async (first: boolean) => {
    try {
      const response = await fetch('/api/surfaces/mail');
      if (!response.ok) return;
      const data = (await response.json()) as {
        provider: 'gmail' | null;
        address: string | null;
        messages: MailMessage[];
      };
      if (!data.provider || !data.address) return;

      const state = get();
      if (first || !state.mailSurface) {
        set({ mailSurface: { provider: data.provider, address: data.address }, inbox: data.messages });
        pushTimeline({
          label: `Inbox connected: ${data.address}`,
          detail: `${data.messages.length} recent messages · new support reports will trigger the workflow`,
          origin: 'system',
          status: 'done',
          app: 'mail',
        });
        return;
      }

      const known = new Set(state.inbox.map((m) => m.id));
      const fresh = data.messages.filter((m) => !known.has(m.id));
      for (const message of fresh.reverse()) {
        const looksLikeReport = understandDeterministic(message).area !== 'unresolved';
        // Only an unread report can fire the trigger; anything else just
        // lands in the inbox like it would in Gmail.
        if (!message.read && looksLikeReport && !get().activeRun) {
          get().deliverMessage({ ...message, isNew: true });
        } else {
          get().receiveMail(message);
          pushTimeline({
            label: looksLikeReport ? 'New support email' : 'New email',
            detail: message.subject,
            origin: 'system',
            status: 'done',
            app: 'mail',
          });
        }
      }
    } catch {
      // The inbox is unreachable; keep what we have.
    }
  };

  const loadLiveTargets = async () => {
    try {
      const response = await fetch('/api/execute');
      if (!response.ok) return;
      const data = (await response.json()) as LiveTargets & { demoMode?: boolean };
      if (data.demoMode) return;
      set({ live: { tracker: data.tracker ?? null, messaging: data.messaging ?? null } });
      if (data.tracker) {
        pushTimeline({
          label: `Live tracker: ${data.tracker.target}`,
          detail: 'Tickets REPEAT files will be created there, after your approval',
          origin: 'system',
          status: 'done',
          app: 'tracker',
        });
      }
      await get().refreshSurfaces();
    } catch {
      // Stay on the replica tracker; nothing to report.
    }
  };

  /**
   * Between "trigger detected" and the Ghost Run opening, REPEAT does its own
   * reading of the report.
   *
   * Demo Mode: nothing happens on the network and the deterministic plan is
   * final. Live: the server reads the report with a model via OpenRouter and
   * researches it via Exa, in parallel, and the run is re-planned from that
   * understanding — same planner, same policy, same rules — before anyone
   * sees it. If the live pass fails or is slow, the deterministic plan
   * stands, and the timeline says why.
   */
  const prepareGhostRun = async (run: AgentRun, message: MailMessage, pattern: LearnedPattern) => {
    // Live, in order of preference: the streaming planner (the Ghost Run
    // arrives action by action over AG-UI), then the REST pass, then the
    // deterministic plan that is already on screen.
    const plan = async (): Promise<
      { understanding: IssueUnderstanding; provenance: UnderstandingProvenance; run?: AgentRun; transport?: string } | null
    > => {
      if (DEMO_MODE) return null;
      const issueNumber = get().nextIssueNumber;
      const total = run.proposedActions.length;
      const streamed = livePlanner
        ? await livePlanner({
            message,
            pattern,
            issueNumber,
            onProgress: (count) =>
              set({ banner: { kind: 'trigger', text: `New bug report received. Planning · ${count} of ${total} steps` } }),
          }).catch(() => null)
        : null;
      if (streamed) {
        return { understanding: streamed.run.understanding, provenance: streamed.provenance, run: streamed.run, transport: streamed.transport };
      }
      const rest: LiveUnderstanding | null = await requestUnderstanding(message);
      return rest ? { understanding: rest.understanding, provenance: rest.provenance } : null;
    };

    const [live] = await Promise.all([plan(), sleep(TIMING.triggerToGhost)]);

    // The run may have been cancelled, executed or replaced while we waited.
    const current = get();
    const stillPlanned =
      current.activeRun?.id === run.id && current.activeRun.status === 'ghost' && !current.activeRun.approved;
    if (!stillPlanned) return;

    if (live) {
      const { understanding, provenance } = live;
      // A streamed run was planned by the same planner on the server; its
      // action ids are re-issued locally so React keys stay unique here.
      const replanned = live.run
        ? { ...live.run, proposedActions: live.run.proposedActions.map((a) => ({ ...a, id: makeId('act') })) }
        : planRun(pattern, message, understanding, current.nextIssueNumber);
      set({
        understanding,
        activeRun: { ...replanned, id: run.id, startedAt: run.startedAt },
        banner: { kind: 'trigger', text: 'New bug report received.' },
      });

      if (live.transport) {
        pushTimeline({
          label: `Ghost Run streamed via ${live.transport}`,
          detail: `${replanned.proposedActions.length} proposed actions arrived as generative UI · no prompt was typed`,
          origin: 'executed',
          status: 'done',
          app: 'repeat',
        });
      }

      pushTimeline({
        label: provenance.usedLlm ? `Report read by ${provenance.model}` : 'Report read by the deterministic classifier',
        detail: provenance.usedLlm
          ? `via ${providerLabel(provenance.provider)} · validated · evidence grounded in the report${
              provenance.llmLatencyMs ? ` · ${(provenance.llmLatencyMs / 1000).toFixed(1)}s` : ''
            }`
          : provenance.fallbackReason,
        origin: 'executed',
        status: 'done',
        app: 'repeat',
      });
      pushTimeline({
        label: provenance.usedResearch
          ? `${provenance.referenceCount} related reference${provenance.referenceCount === 1 ? '' : 's'} found via Exa`
          : 'No related context attached',
        detail: provenance.usedResearch ? `searched: ${provenance.researchQuery}` : provenance.researchReason,
        origin: 'executed',
        status: 'done',
        app: 'repeat',
      });
    }

    if (get().phase === 'trigger_detected') get().openGhostRun();
  };

  /** Append events to the active trace and recompute live confidence. */
  const appendEvents = (events: SemanticEvent[]) => {
    const state = get();
    if (!state.activeTrace) return;
    const activeTrace: WorkflowTrace = {
      ...state.activeTrace,
      events: [...state.activeTrace.events, ...events],
    };
    const live = liveConfidence(state.traces, activeTrace);
    set({
      activeTrace,
      confidence: live,
      confidencePeak: Math.max(state.confidencePeak, live),
    });
  };

  const beginTraceIfNeeded = (label: string, sourceRef?: string) => {
    const state = get();
    if (state.activeTrace) return;
    set({
      activeTrace: {
        id: makeId('trace'),
        label,
        startedAt: new Date().toISOString(),
        events: [],
        sourceRef,
      },
      phase: 'observing',
      orb: 'learning',
    });
    pushTimeline({
      label: `Observation ${state.traces.length + 1} started`,
      detail: label,
      origin: 'system',
      status: 'done',
    });
  };

  return {
    ready: false,
    phase: 'idle',
    orb: 'idle',

    traces: [],
    activeTrace: null,
    confidence: 0,
    confidencePeak: 0,

    patterns: [],
    collapsing: false,

    runs: [],
    activeRun: null,
    runningIndex: -1,

    inbox: [],
    selectedMailId: null,
    clipboard: null,
    understanding: null,
    composer: emptyComposer,
    issues: [],
    nextIssueNumber: FIRST_ISSUE_NUMBER,
    chat: [],
    activeChannel: START_CHANNEL,
    chatDraft: '',

    timeline: [],
    metrics: initialMetrics,
    settings: { soundOn: false, guideOn: true, observationPaused: false, excludedApps: [] },
    failAt: 'none',
    banner: null,
    deliveredCount: 1,
    live: null,
    surfaces: null,
    mailSurface: null,
    trackerView: null,

    /* ------------------------------------------------------------------ */
    /* lifecycle                                                          */
    /* ------------------------------------------------------------------ */

    // Called from a client effect so no timestamp is ever generated during
    // SSR — that would desynchronise hydration.
    init: () => {
      if (get().ready) return;
      set({
        ready: true,
        inbox: initialInbox(),
        issues: initialIssues(),
        chat: initialChat(),
        timeline: [
          {
            id: makeId('tl'),
            at: stamp(2),
            label: 'REPEAT active',
            detail: 'Observing Mail, Issue Tracker and Team Chat',
            origin: 'system',
            status: 'done',
          },
        ],
      });

      // Live mode: ask the server once where consequential steps would land,
      // so the Ghost Run can say so before anyone approves, and start
      // listening to the Chrome extension. Demo Mode never makes a request.
      if (!DEMO_MODE) {
        void loadLiveTargets();
        void loadMail(true);
        setInterval(() => void loadMail(false), MAIL_POLL_MS);
        startExtensionFeed(
          { getState: get },
          (event, summary) => {
            const app = (['mail', 'tracker', 'chat'].includes(event.sourceApp) ? event.sourceApp : 'repeat') as SourceApp;
            pushTimeline({
              label: summary,
              detail: event.pageContext?.title ? event.pageContext.title.slice(0, 80) : undefined,
              origin: summary.startsWith('Watching') ? 'system' : 'observed',
              status: 'done',
              app,
            });
          },
        );
      }
    },

    reset: () => {
      resetIdCounter();
      set({
        ready: true,
        phase: 'idle',
        orb: 'idle',
        traces: [],
        activeTrace: null,
        confidence: 0,
        confidencePeak: 0,
        patterns: [],
        collapsing: false,
        runs: [],
        activeRun: null,
        runningIndex: -1,
        inbox: initialInbox(),
        selectedMailId: null,
        clipboard: null,
        understanding: null,
        composer: emptyComposer,
        issues: initialIssues(),
        nextIssueNumber: FIRST_ISSUE_NUMBER,
        chat: initialChat(),
        activeChannel: START_CHANNEL,
        chatDraft: '',
        timeline: [
          {
            id: makeId('tl'),
            at: new Date().toISOString(),
            label: 'REPEAT active',
            detail: 'Observing Mail, Issue Tracker and Team Chat',
            origin: 'system',
            status: 'done',
          },
        ],
        metrics: initialMetrics,
        failAt: 'none',
        banner: null,
        deliveredCount: 1,
      });
    },

    /* ------------------------------------------------------------------ */
    /* observation                                                        */
    /* ------------------------------------------------------------------ */

    observe: (action, data = {}) => {
      const state = get();
      if (state.settings.observationPaused) return;
      const spec = specFor(action);
      if (state.settings.excludedApps.includes(spec.app)) return;
      if (!state.activeTrace) return;

      const traceId = state.activeTrace.id;
      const events: SemanticEvent[] = [];

      // Latent steps REPEAT names rather than observes.
      for (const inferred of inferenceFor(action)) {
        const u = get().understanding;
        const payload =
          inferred === 'issue.extract_details'
            ? { issueTitle: u?.issueTitle, issueDescription: u?.issueDescription }
            : { category: u?.category, area: u?.area, severity: u?.severity };
        events.push(normalize({ action: inferred, data: payload }, traceId));
      }

      events.push(normalize({ action, data }, traceId));
      appendEvents(events);

      for (const e of events) {
        pushTimeline({
          label: specFor(e.action).label,
          detail: e.inferred ? 'inferred by REPEAT' : undefined,
          origin: 'observed',
          status: 'done',
          app: e.sourceApp,
        });
      }
    },

    receiveMail: (message) => {
      if (get().inbox.some((m) => m.id === message.id)) return;
      set((s) => ({ inbox: [message, ...s.inbox] }));
    },

    readMail: (id) => {
      const state = get();
      const message = state.inbox.find((m) => m.id === id);
      if (!message) return;

      set({
        selectedMailId: id,
        inbox: state.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)),
      });

      // Noise is read without starting an observation — REPEAT is not
      // learning "the user reads email", it is learning bug triage.
      if (message.fixtureRef === 'noise') return;

      const understanding = understandDeterministic(message);
      // A new report means a fresh pass: drop the previous clipboard so the
      // human actually copies again rather than inheriting the last capture.
      set({ understanding, clipboard: state.activeTrace ? state.clipboard : null });

      beginTraceIfNeeded(`Triage: ${message.subject}`, message.fixtureRef);
      get().observe('mail.read_message', {
        customerName: understanding.customerName,
        customerEmail: understanding.customerEmail,
      });
    },

    copyMail: () => {
      const { selectedMailId, inbox } = get();
      const message = inbox.find((m) => m.id === selectedMailId);
      if (!message) return;
      set({ clipboard: message.body });
      get().observe('mail.copy_content');
    },

    openComposer: () => {
      set({ composer: { ...emptyComposer, open: true } });
      get().observe('tracker.open_composer');
    },

    pasteIntoComposer: () => {
      const { understanding } = get();
      if (!understanding) return;
      set((s) => ({
        composer: {
          ...s.composer,
          open: true,
          title: understanding.issueTitle,
          body: understanding.issueDescription,
          touched: [...new Set([...s.composer.touched, 'title', 'body'])],
        },
      }));
      get().observe('tracker.compose_issue', {
        issueTitle: understanding.issueTitle,
        issueDescription: understanding.issueDescription,
      });
    },

    toggleLabel: (label) => {
      set((s) => {
        const has = s.composer.labels.includes(label);
        return {
          composer: {
            ...s.composer,
            labels: has
              ? s.composer.labels.filter((l) => l !== label)
              : [...s.composer.labels, label],
            touched: [...new Set([...s.composer.touched, 'labels'])],
          },
        };
      });
      // One semantic action per labelling decision set, not per click.
      const { composer, activeTrace } = get();
      const already = activeTrace?.events.some((e) => e.action === 'tracker.apply_labels');
      if (!already && composer.labels.length > 0) {
        get().observe('tracker.apply_labels', { labels: composer.labels });
      }
    },

    setPriority: (p) => {
      set((s) => ({
        composer: {
          ...s.composer,
          priority: p,
          touched: [...new Set([...s.composer.touched, 'priority'])],
        },
      }));
      get().observe('tracker.set_priority', { severity: p });
    },

    setAssignee: (name) => {
      const { understanding } = get();
      set((s) => ({
        composer: {
          ...s.composer,
          assignee: name,
          touched: [...new Set([...s.composer.touched, 'assignee'])],
        },
      }));
      get().observe('tracker.assign_owner', { owner: name, area: understanding?.area });
    },

    submitIssue: () => {
      const state = get();
      const { composer, understanding } = state;
      if (!composer.title) return;

      const number = state.nextIssueNumber;
      const issue: TrackerIssue = {
        id: makeId('issue'),
        number,
        title: composer.title,
        body: composer.body,
        labels: composer.labels,
        priority: (composer.priority || 'medium') as IssueSeverity,
        assignee: composer.assignee || undefined,
        createdAt: new Date().toISOString(),
        createdBy: 'human',
        state: 'open',
      };

      set({
        issues: [issue, ...state.issues],
        nextIssueNumber: number + 1,
        composer: emptyComposer,
      });

      get().observe('tracker.create_issue', { issueNumber: number });

      // Pre-compute the notification the human is about to write.
      if (understanding) {
        const owner = composer.assignee || routeOwner(understanding.area).owner || 'unassigned';
        set({ chatDraft: composeTeamMessage({ understanding, issueNumber: number, owner }) });
      }
    },

    openChannel: (channel) => {
      set({ activeChannel: channel });
      if (channel === DEFAULT_CHANNEL) get().observe('chat.open_channel', { channel });
    },

    draftTeamMessage: () => {
      const { chatDraft } = get();
      if (!chatDraft) return;
      get().observe('chat.compose_message', { teamMessage: chatDraft });
    },

    sendTeamMessage: () => {
      const state = get();
      if (!state.chatDraft) return;
      const message: ChatMessage = {
        id: makeId('chat'),
        channel: state.activeChannel,
        author: 'You',
        body: state.chatDraft,
        at: new Date().toISOString(),
        sentBy: 'human',
      };
      set({ chat: [...state.chat, message], chatDraft: '' });
      get().observe('chat.notify_team', { channel: state.activeChannel });
      // The workflow is finished; hand over to the detector.
      get().completeTrace();
    },

    /* ------------------------------------------------------------------ */
    /* learning                                                           */
    /* ------------------------------------------------------------------ */

    completeTrace: () => {
      const state = get();
      if (!state.activeTrace) return;

      const finished: WorkflowTrace = {
        ...state.activeTrace,
        endedAt: new Date().toISOString(),
        outcome: 'completed',
      };
      const traces = [...state.traces, finished];
      set({ traces, activeTrace: null, phase: 'comparing', orb: 'learning' });

      pushTimeline({
        label: `Observation ${traces.length} complete`,
        detail: `${finished.events.length} semantic actions captured`,
        origin: 'system',
        status: 'done',
      });

      const result = detect(traces);

      if (result.kind === 'pattern') {
        const pattern = compilePattern(result.matched);
        set({
          confidence: pattern.confidence,
          confidencePeak: Math.max(get().confidencePeak, pattern.confidence),
        });
        // Let the comparison read for a beat before the reveal.
        window.setTimeout(() => {
          set({ patterns: [pattern], phase: 'pattern_discovered', orb: 'pattern' });
          pushTimeline({
            label: 'Pattern discovered',
            detail: `${pattern.name} · ${pattern.observations} observations`,
            origin: 'system',
            status: 'done',
          });
          cue('pattern');
        }, TIMING.compareDwell);
        return;
      }

      // Not a pattern yet: settle back to observing.
      const confidence = result.kind === 'insufficient' ? result.confidence : result.confidence;
      set({
        confidence,
        confidencePeak: Math.max(get().confidencePeak, confidence),
        phase: 'idle',
        orb: 'idle',
      });
    },

    showPatternFirst: () => {
      // Inspecting before approving is itself worth recording.
      pushTimeline({
        label: "Pattern inspected before approval",
        detail: "evidence and compiled template reviewed",
        origin: "system",
        status: "done",
      });
    },

    approvePattern: () => {
      const state = get();
      const pattern = state.patterns[0];
      if (!pattern) return;

      // The collapse moment: the observed steps converge into one agent.
      set({ collapsing: true, orb: 'pattern' });
      cue('collapse');

      window.setTimeout(() => {
        set((s) => ({
          patterns: s.patterns.map((p) =>
            p.id === pattern.id ? { ...p, status: 'active' } : p,
          ),
          phase: 'agent_ready',
          collapsing: false,
          orb: 'idle',
        }));
        pushTimeline({
          label: 'Bug Triage Agent activated',
          detail: 'Human approval required before every run',
          origin: 'system',
          status: 'done',
        });
      }, 1500);
    },

    /* ------------------------------------------------------------------ */
    /* runs                                                               */
    /* ------------------------------------------------------------------ */

    deliverNextBug: () => {
      get().deliverBug(get().deliveredCount);
    },

    deliverBug: (index) => {
      const fixture = BUG_FIXTURES[index];
      if (!fixture) return;
      const state = get();
      if (state.inbox.some((m) => m.id === fixture.id)) return;
      set({ deliveredCount: Math.max(state.deliveredCount, index + 1) });
      get().deliverMessage({ ...fixture, receivedAt: new Date().toISOString(), read: false, isNew: true });
    },

    deliverMessage: (message) => {
      const state = get();
      if (!state.inbox.some((m) => m.id === message.id)) {
        set({ inbox: [message, ...state.inbox] });
      }
      cue('mail');

      const activePattern = state.patterns.find((p) => p.status === 'active');
      if (!activePattern) {
        pushTimeline({
          label: 'New support email',
          detail: message.subject,
          origin: 'system',
          status: 'done',
          app: 'mail',
        });
        return;
      }

      // A learned pattern is active and its trigger matches: REPEAT takes over.
      const understanding = understandDeterministic(message);
      const run = planRun(activePattern, message, understanding, state.nextIssueNumber);

      set({
        phase: 'trigger_detected',
        orb: 'pattern',
        understanding,
        selectedMailId: message.id,
        inbox: get().inbox.map((m) => (m.id === message.id ? { ...m, read: true } : m)),
        activeRun: run,
        banner: { kind: 'trigger', text: 'New bug report received.' },
      });

      pushTimeline({
        label: 'Trigger detected',
        detail: run.triggerSummary,
        origin: 'system',
        status: 'done',
        app: 'mail',
      });
      cue('trigger');

      void prepareGhostRun(run, message, activePattern);
    },

    openGhostRun: () => {
      const run = get().activeRun;
      if (!run) return;
      set({ phase: 'ghost_run', orb: 'ghost', banner: null });
      pushTimeline({
        label: 'Ghost Run prepared',
        detail: 'No external changes have been made',
        origin: 'system',
        status: 'done',
      });
      cue('ghost');
    },

    resolveOwner: (owner) => {
      const run = get().activeRun;
      if (!run) return;
      set({ activeRun: applyOwnerOverride(run, owner) });
      pushTimeline({
        label: 'Owner selected by you',
        detail: owner,
        origin: 'system',
        status: 'done',
      });
    },

    cancelRun: () => {
      const run = get().activeRun;
      if (!run) return;
      set({
        activeRun: null,
        phase: 'agent_ready',
        orb: 'idle',
        runs: [...get().runs, { ...run, status: 'cancelled', endedAt: new Date().toISOString() }],
      });
      pushTimeline({
        label: 'Ghost Run cancelled',
        detail: 'Nothing was created or sent',
        origin: 'system',
        status: 'done',
      });
    },

    approveAndExecute: async () => {
      const state = get();
      const run = state.activeRun;
      if (!run) return;

      // Re-entrancy guard. Execute is reachable from both the Ghost Run panel
      // and the rail card, and a nervous double-click on stage would
      // otherwise file the ticket twice and post twice. A run may only be
      // started from the ghost state, exactly once.
      if (state.phase === 'executing' || run.status !== 'ghost' || run.approved) return;

      // A step still awaiting a human decision blocks the run — but refusing
      // must be a no-op, not a failure. Poisoning the run into an error state
      // would make the review unresolvable, which is the opposite of asking.
      const unresolved = run.proposedActions.find((a) => a.status === 'needs_review');
      if (unresolved) {
        set({
          banner: {
            kind: 'info',
            text: `Waiting on you: ${unresolved.review?.field ?? 'a value'} could not be resolved confidently.`,
          },
        });
        return;
      }

      const approved: AgentRun = {
        ...run,
        approved: true,
        approvedAt: new Date().toISOString(),
        status: 'executing',
      };
      set({ activeRun: approved, phase: 'executing', orb: 'executing', runningIndex: 0 });
      pushTimeline({ label: 'Approved by you', origin: 'system', status: 'done' });

      // Adapter binding — the only thing that differs between Demo Mode and
      // live. The executor, the guard and the run are the same object either
      // way. Live binds a remote adapter only for the services the server
      // reported as configured; anything else stays in the replica app.
      const adapterOpts = { startNumber: state.nextIssueNumber, failAt: state.failAt };
      const tracker =
        !DEMO_MODE && state.live?.tracker
          ? new RemoteIssueTrackerAdapter(adapterOpts)
          : new DemoIssueTrackerAdapter(adapterOpts);
      const messaging =
        !DEMO_MODE && state.live?.messaging
          ? new RemoteMessagingAdapter({ failAt: state.failAt })
          : new DemoMessagingAdapter({ failAt: state.failAt });

      const finished = await executeRun(approved, {
        tracker,
        messaging,
        stepDelayMs: TIMING.executeStep,
        onStep: (action, index) => {
          set((s) => ({
            runningIndex: index,
            activeRun: s.activeRun
              ? {
                  ...s.activeRun,
                  proposedActions: s.activeRun.proposedActions.map((a) =>
                    a.id === action.id ? { ...action } : a,
                  ),
                }
              : s.activeRun,
          }));

          if (action.status === 'running') {
            pushTimeline({
              label: action.title,
              origin: 'executed',
              status: 'active',
              app: action.app,
            });
          } else {
            settleTimeline();
            set((s) => ({
              timeline: s.timeline.map((t, i) =>
                i === s.timeline.length - 1
                  ? {
                      ...t,
                      status: action.status === 'failed' ? 'failed' : 'done',
                      detail: action.result?.summary,
                    }
                  : t,
              ),
            }));
          }
        },
      });

      // Mirror the adapters' real state into the replica app windows.
      set((s) => ({
        issues: [...tracker.issues.map((i) => ({ ...i })).reverse(), ...s.issues],
        nextIssueNumber: s.nextIssueNumber + tracker.issues.length,
        chat: [...s.chat, ...messaging.messages],
        // Surface the channel REPEAT posted in, otherwise the notification
        // lands off-screen and the run looks like it did nothing.
        activeChannel: messaging.messages[0]?.channel ?? s.activeChannel,
      }));

      const verification = verifyRun(finished);
      if (!DEMO_MODE && tracker.live) void get().refreshSurfaces();

      if (finished.status === 'completed' && verification.ok) {
        set((s) => ({
          activeRun: finished,
          runs: [...s.runs, finished],
          phase: 'completed',
          orb: 'success',
          runningIndex: -1,
          metrics: {
            runs: s.metrics.runs + 1,
            successfulRuns: s.metrics.successfulRuns + 1,
            manualActionsAvoided: s.metrics.manualActionsAvoided + finished.manualActionsAvoided,
            timeSavedSeconds: s.metrics.timeSavedSeconds + finished.timeSavedSeconds,
            humanInterventions: s.metrics.humanInterventions + finished.humanInterventions,
          },
        }));
        pushTimeline({
          label: 'Workflow complete',
          detail: `${finished.manualActionsAvoided} manual actions replaced by 1 approval`,
          origin: 'executed',
          status: 'done',
        });
        cue('success');
        await sleep(TIMING.successHold);
        set((s) => (s.orb === 'success' ? { orb: 'idle' } : {}));
        return;
      }

      const failedIndex = finished.failureStepIndex ?? 0;
      const failedAction = finished.proposedActions[failedIndex];
      set((s) => ({
        activeRun: finished,
        runs: [...s.runs, finished],
        phase: 'error',
        orb: 'error',
        runningIndex: -1,
        banner: {
          kind: 'error',
          text: failedAction?.result?.error ?? 'A step could not be completed.',
        },
        metrics: {
          ...s.metrics,
          runs: s.metrics.runs + 1,
          humanInterventions: s.metrics.humanInterventions + 1,
        },
      }));
      pushTimeline({
        label: `Failed at step ${failedIndex + 1}`,
        detail: failedAction?.result?.error,
        origin: 'executed',
        status: 'failed',
      });
      cue('error');
    },

    retryRun: async () => {
      const run = get().activeRun;
      if (!run) return;
      // Clear the injected failure and replan the remaining steps.
      set({
        failAt: 'none',
        banner: null,
        activeRun: {
          ...run,
          status: 'ghost',
          approved: false,
          failureStepIndex: undefined,
          proposedActions: run.proposedActions.map((a) =>
            a.status === 'failed' || a.status === 'skipped'
              ? { ...a, status: 'planned', result: undefined }
              : a,
          ),
        },
        phase: 'ghost_run',
        orb: 'ghost',
      });
      pushTimeline({
        label: 'Retry prepared',
        detail: 'Completed steps preserved',
        origin: 'system',
        status: 'done',
      });
    },

    /* ------------------------------------------------------------------ */
    /* settings / demo                                                    */
    /* ------------------------------------------------------------------ */

    setSetting: (key, value) => {
      set((s) => ({ settings: { ...s.settings, [key]: value } }));
    },

    /**
     * Live mode: the tracker window shows the real board REPEAT files into.
     * Issues created by REPEAT in this session keep their "by repeat" mark;
     * everything else is whatever the board says right now.
     */
    refreshSurfaces: async () => {
      if (DEMO_MODE) return;
      try {
        const response = await fetch('/api/surfaces/tracker');
        if (!response.ok) return;
        const data = (await response.json()) as { trackers: TrackerSurface[] };
        const trackers = data.trackers ?? [];
        const boundName = get().live?.tracker?.name;
        const view =
          get().trackerView ??
          (trackers.find((t) => t.provider === boundName)?.provider ?? trackers[0]?.provider ?? null);
        const board = trackers.find((t) => t.provider === view);
        set((s) => {
          const mine = new Map(s.issues.filter((i) => i.createdBy === 'repeat').map((i) => [i.id, i]));
          if (!board) return { surfaces: { trackers }, trackerView: view };
          const listed = new Set(board.issues.map((i) => i.id));
          const issues = board.issues.map((i) => {
            const created = mine.get(i.id);
            return created ? { ...i, number: created.number, createdBy: 'repeat' as const } : i;
          });
          // A ticket REPEAT just filed can lag behind the board's search index
          // for a moment; keep it on screen until the board lists it.
          const pending = [...mine.values()].filter((i) => !listed.has(i.id) && i.provider === board.provider);
          return { surfaces: { trackers }, trackerView: view, issues: [...pending, ...issues] };
        });
      } catch {
        // The replica list stays; nothing to report.
      }
    },

    setTrackerView: (provider) => {
      set({ trackerView: provider });
      void get().refreshSurfaces();
    },

    setFailAt: (p) => set({ failAt: p }),

    forgetPattern: (id) => {
      set((s) => ({
        patterns: s.patterns.filter((p) => p.id !== id),
        phase: 'idle',
        orb: 'idle',
        traces: [],
        confidence: 0,
        confidencePeak: 0,
      }));
      pushTimeline({
        label: 'Workflow forgotten',
        detail: 'Observations and compiled pattern deleted',
        origin: 'system',
        status: 'done',
      });
    },

    setPatternStatus: (id, status) => {
      set((s) => ({
        patterns: s.patterns.map((p) => (p.id === id ? { ...p, status } : p)),
      }));
    },

    clearHistory: () => {
      set({ timeline: [], runs: [] });
    },

    /**
     * Replay one full observation headlessly. Used by the demo console when
     * there is no time to click through the workflow by hand; it produces the
     * exact same events the manual path does.
     */
    runObservationInstantly: (index) => {
      const fixture = BUG_FIXTURES[index];
      if (!fixture) return;
      const state = get();

      const message: MailMessage = {
        ...fixture,
        receivedAt: new Date().toISOString(),
        read: true,
      };
      if (!state.inbox.some((m) => m.id === fixture.id)) {
        set({ inbox: [message, ...state.inbox] });
      }

      const understanding = understandDeterministic(message);
      const owner = routeOwner(understanding.area).owner ?? 'unassigned';
      const number = get().nextIssueNumber;

      set({ selectedMailId: message.id, understanding, activeChannel: DEFAULT_CHANNEL });
      beginTraceIfNeeded(`Triage: ${message.subject}`, message.fixtureRef);

      // Walk the real observable sequence through the real observe() path.
      const steps: [SemanticAction, Record<string, unknown>][] = [
        ['mail.read_message', { customerName: understanding.customerName, customerEmail: understanding.customerEmail }],
        ['mail.copy_content', {}],
        ['tracker.open_composer', {}],
        ['tracker.compose_issue', { issueTitle: understanding.issueTitle, issueDescription: understanding.issueDescription }],
        ['tracker.apply_labels', { labels: understanding.labels }],
        ['tracker.set_priority', { severity: understanding.severity }],
        ['tracker.assign_owner', { owner, area: understanding.area }],
        ['tracker.create_issue', { issueNumber: number }],
        ['chat.open_channel', { channel: DEFAULT_CHANNEL }],
        ['chat.compose_message', { teamMessage: composeTeamMessage({ understanding, issueNumber: number, owner }) }],
        ['chat.notify_team', { channel: DEFAULT_CHANNEL }],
      ];
      for (const [action, data] of steps) get().observe(action, data);

      // Materialise the same consequences the manual path produces.
      const issue: TrackerIssue = {
        id: makeId('issue'),
        number,
        title: understanding.issueTitle,
        body: understanding.issueDescription,
        labels: understanding.labels,
        priority: understanding.severity,
        assignee: owner,
        createdAt: new Date().toISOString(),
        createdBy: 'human',
        state: 'open',
      };
      const chatMessage: ChatMessage = {
        id: makeId('chat'),
        channel: DEFAULT_CHANNEL,
        author: 'You',
        body: composeTeamMessage({ understanding, issueNumber: number, owner }),
        at: new Date().toISOString(),
        sentBy: 'human',
      };
      set((s) => ({
        issues: [issue, ...s.issues],
        nextIssueNumber: number + 1,
        chat: [...s.chat, chatMessage],
        deliveredCount: Math.max(s.deliveredCount, index + 1),
      }));

      get().completeTrace();
    },
  };
});

/* ---------------------------------------------------------------------- */
/* selectors                                                              */
/* ---------------------------------------------------------------------- */

/** The next click the guide should point at, or null when not observing. */
export function selectNextAction(s: RepeatState): SemanticAction | null {
  if (!s.activeTrace) {
    // Before anything is observed, the next move is to read the bug report.
    if (s.phase === 'idle' && s.patterns.length === 0) return 'mail.read_message';
    return null;
  }
  const done = new Set(s.activeTrace.events.map((e) => e.action));
  return OBSERVABLE_SEQUENCE.find((a) => !done.has(a)) ?? null;
}

export function selectObservedCount(s: RepeatState): number {
  return s.activeTrace?.events.filter((e) => !e.inferred).length ?? 0;
}

export function selectActivePattern(s: RepeatState): LearnedPattern | null {
  return s.patterns.find((p) => p.status === 'active') ?? s.patterns[0] ?? null;
}
