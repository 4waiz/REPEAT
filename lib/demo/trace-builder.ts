import type { IssueUnderstanding, MailMessage, SemanticAction, WorkflowTrace } from '@/types';
import { normalize } from '@/lib/events/normalizer';
import { makeId } from '@/lib/utils';
import { routeOwner } from '@/lib/demo/team';
import { DEFAULT_CHANNEL, composeTeamMessage } from '@/lib/agents/compose';

/**
 * Headless trace construction.
 *
 * In the live demo the human clicks through the replica apps and each click
 * is normalized into an event one at a time. This module builds the identical
 * 13-event trace in one call, which is what the engine self-test and the
 * "replay observation" demo control use. Both paths produce the same shape —
 * there is no separate "fake" event format.
 */

/** The observable click sequence of one manual triage pass, in order. */
export const MANUAL_SEQUENCE: SemanticAction[] = [
  'mail.read_message',
  'mail.copy_content',
  // REPEAT names these two latent steps; the human never clicked them.
  'issue.extract_details',
  'issue.classify',
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

/**
 * The structured payload each action contributes. These keys are exactly what
 * the compiler later diffs to decide variables vs. constants.
 */
export function payloadFor(
  action: SemanticAction,
  ctx: {
    message: MailMessage;
    understanding: IssueUnderstanding;
    owner: string;
    issueNumber: number;
    teamMessage: string;
  },
): Record<string, unknown> {
  const { message, understanding: u, owner, issueNumber, teamMessage } = ctx;
  switch (action) {
    case 'mail.read_message':
      return { customerName: u.customerName, customerEmail: u.customerEmail };
    case 'mail.copy_content':
      return {};
    case 'issue.extract_details':
      return { issueTitle: u.issueTitle, issueDescription: u.issueDescription };
    case 'issue.classify':
      return { category: u.category, area: u.area, severity: u.severity };
    case 'tracker.open_composer':
      return {};
    case 'tracker.compose_issue':
      return { issueTitle: u.issueTitle, issueDescription: u.issueDescription };
    case 'tracker.apply_labels':
      return { labels: u.labels };
    case 'tracker.set_priority':
      return { severity: u.severity };
    case 'tracker.assign_owner':
      return { owner, area: u.area };
    case 'tracker.create_issue':
      return { issueNumber };
    case 'chat.open_channel':
      return { channel: DEFAULT_CHANNEL };
    case 'chat.compose_message':
      return { teamMessage };
    case 'chat.notify_team':
      return { channel: DEFAULT_CHANNEL };
    default:
      return { messageId: message.id };
  }
}

/**
 * Realistic human variation.
 *
 * People do not repeat themselves byte-for-byte. `reread` models the very
 * common case of glancing back at the email while writing the ticket. It
 * matters: it is what forces the detector's edit-distance tolerance to
 * actually do work, and it is why pattern confidence lands in the nineties
 * rather than at a suspicious 100%.
 */
export type TraceVariation = 'none' | 'reread';

function sequenceFor(variation: TraceVariation): SemanticAction[] {
  if (variation === 'reread') {
    const seq = [...MANUAL_SEQUENCE];
    seq.splice(seq.indexOf('tracker.compose_issue') + 1, 0, 'mail.read_message');
    return seq;
  }
  return MANUAL_SEQUENCE;
}

export function buildTrace(
  message: MailMessage,
  understanding: IssueUnderstanding,
  label: string,
  opts: {
    issueNumber?: number;
    startedAt?: Date;
    stepSeconds?: number;
    variation?: TraceVariation;
  } = {},
): WorkflowTrace {
  const traceId = makeId('trace');
  const issueNumber = opts.issueNumber ?? 42;
  const owner = routeOwner(understanding.area).owner ?? 'unassigned';
  const teamMessage = composeTeamMessage({ understanding, issueNumber, owner });
  const startedAt = opts.startedAt ?? new Date();
  const stepSeconds = opts.stepSeconds ?? 12;

  const events = sequenceFor(opts.variation ?? 'none').map((action, i) =>
    normalize(
      {
        action,
        entityId: message.id,
        data: payloadFor(action, { message, understanding, owner, issueNumber, teamMessage }),
        origin: 'observed',
        at: new Date(startedAt.getTime() + i * stepSeconds * 1000),
      },
      traceId,
    ),
  );

  return {
    id: traceId,
    label,
    startedAt: startedAt.toISOString(),
    endedAt: events[events.length - 1].timestamp,
    events,
    outcome: 'completed',
    sourceRef: message.fixtureRef,
  };
}
