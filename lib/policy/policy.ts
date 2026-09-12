import type {
  PermissionClass,
  PlannedAction,
  PolicyDecision,
  RiskLevel,
  SemanticAction,
} from '@/types';
import { specFor } from '@/lib/events/taxonomy';

/**
 * Policy / Approval layer.
 *
 * The model never decides what is safe. This table does. Every planned action
 * is classified by consequence, and anything that changes the outside world
 * or speaks on the user's behalf stops for a human.
 */

export const PERMISSION_POLICY: Record<
  PermissionClass,
  { label: string; allowed: boolean; requiresApproval: boolean; rationale: string }
> = {
  read: {
    label: 'Read',
    allowed: true,
    requiresApproval: false,
    rationale: 'Reads existing content. No change leaves the system.',
  },
  analyze: {
    label: 'Analyze',
    allowed: true,
    requiresApproval: false,
    rationale: 'Interprets content already read. No side effects.',
  },
  draft: {
    label: 'Draft',
    allowed: true,
    requiresApproval: false,
    rationale: 'Prepares content locally. Nothing is published.',
  },
  create_external: {
    label: 'Create external resource',
    allowed: true,
    requiresApproval: true,
    rationale: 'Creates a record other people will see. Needs approval.',
  },
  send_message: {
    label: 'Send message',
    allowed: true,
    requiresApproval: true,
    rationale: 'Speaks to other people as the user. Needs approval.',
  },
  delete: {
    label: 'Delete',
    allowed: true,
    requiresApproval: true,
    rationale: 'Destructive and hard to reverse. Always needs approval.',
  },
  payment: {
    label: 'Payment / high risk',
    allowed: false,
    requiresApproval: true,
    rationale: 'Blocked in this prototype. REPEAT will not move money.',
  },
};

export function permissionFor(action: SemanticAction): PermissionClass {
  return specFor(action).permission;
}

export function requiresApproval(permission: PermissionClass): boolean {
  return PERMISSION_POLICY[permission].requiresApproval;
}

export function decide(permission: PermissionClass): PolicyDecision {
  const p = PERMISSION_POLICY[permission];
  return {
    permission,
    allowed: p.allowed,
    requiresApproval: p.requiresApproval,
    rationale: p.rationale,
  };
}

/**
 * Run-level risk. Driven by the most consequential permission in the plan,
 * then raised if confidence is low or anything needs review.
 */
export function assessRisk(actions: PlannedAction[], confidence: number): RiskLevel {
  if (actions.some((a) => a.permission === 'payment')) return 'blocked';

  const hasReview = actions.some((a) => a.status === 'needs_review');
  const worst = actions.reduce<PermissionClass>((w, a) => {
    const order: PermissionClass[] = [
      'read',
      'analyze',
      'draft',
      'create_external',
      'send_message',
      'delete',
      'payment',
    ];
    return order.indexOf(a.permission) > order.indexOf(w) ? a.permission : w;
  }, 'read');

  if (worst === 'delete') return 'high';
  if (hasReview) return 'medium';
  if (confidence < 0.7) return 'medium';
  // Creating a ticket and posting to an internal channel, both reversible,
  // both gated behind approval.
  return 'low';
}

/**
 * Hard guard. The executor calls this before every single action; it is the
 * reason a Ghost Run cannot leak into the world before a human says yes.
 */
export function assertExecutable(opts: {
  approved: boolean;
  permission: PermissionClass;
}): void {
  const policy = PERMISSION_POLICY[opts.permission];
  if (!policy.allowed) {
    throw new Error(`Blocked by policy: ${policy.label} is not permitted in this prototype.`);
  }
  if (policy.requiresApproval && !opts.approved) {
    throw new Error(
      `Blocked by policy: ${policy.label} requires human approval and this run is not approved.`,
    );
  }
}

export const PERMISSION_ORDER: PermissionClass[] = [
  'read',
  'analyze',
  'draft',
  'create_external',
  'send_message',
  'delete',
  'payment',
];
