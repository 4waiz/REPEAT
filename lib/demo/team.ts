import type { EngineeringArea, TeamMember } from '@/types';

/**
 * The support desk. Ownership is a function of department, which is why
 * REPEAT can route a complaint it has never seen to a person it never
 * observed being assigned.
 *
 * These names are the ones the ClickUp adapter resolves against — either by
 * first-name prefix, or explicitly through CLICKUP_ASSIGNEES in .env.
 */
export const TEAM: TeamMember[] = [
  {
    id: 'awaiz',
    name: 'Awaiz',
    role: 'Billing & Finance',
    area: 'billing',
    handle: '@awaiz',
    accent: '#2dd4a7',
  },
  {
    id: 'umar',
    name: 'Umar',
    role: 'Technical Support',
    area: 'technical-support',
    handle: '@umar',
    accent: '#38dcff',
  },
  {
    id: 'bilal',
    name: 'Bilal',
    role: 'Sales & Account Management',
    area: 'sales',
    handle: '@bilal',
    accent: '#f5b544',
  },
  {
    id: 'obaid',
    name: 'Obaid',
    role: 'Logistics, Shipping & Fulfilment',
    area: 'logistics',
    handle: '@obaid',
    accent: '#ff8fa3',
  },
  {
    id: 'noor',
    name: 'Noor',
    role: 'Product Development & Engineering',
    area: 'product-rnd',
    handle: '@noor',
    accent: '#8b7cff',
  },
  {
    id: 'huda',
    name: 'Huda',
    role: 'Legal, Privacy & Compliance',
    area: 'legal-compliance',
    handle: '@huda',
    accent: '#b4a8ff',
  },
];

/** area -> owner. The routing table the Ghost Run cites by name. */
export const ROUTING_RULES: Record<EngineeringArea, string | null> = {
  billing: 'Awaiz',
  'technical-support': 'Umar',
  sales: 'Bilal',
  logistics: 'Obaid',
  'product-rnd': 'Noor',
  'legal-compliance': 'Huda',
  unresolved: null,
};

export function routeOwner(area: EngineeringArea): { owner: string | null; rule: string } {
  const owner = ROUTING_RULES[area];
  return {
    owner,
    rule: owner ? `${area} -> ${owner}` : 'no rule matched',
  };
}

export function memberByName(name: string): TeamMember | undefined {
  return TEAM.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

export function memberByArea(area: EngineeringArea): TeamMember | undefined {
  return TEAM.find((m) => m.area === area);
}

export const ROUTING_RULE_LIST = TEAM.map((m) => ({
  area: m.area,
  owner: m.name,
  label: `${m.area} -> ${m.name}`,
}));

/**
 * Which Slack channel each department is announced in.
 *
 * Ownership and audience are two different questions: a billing complaint is
 * Awaiz's to answer, but the desk that needs to hear about it is the finance
 * channel. This table answers the second one. Override without touching code:
 * SLACK_AREA_CHANNELS="billing=billing-finance,sales=sales-accounts".
 */
export const DEFAULT_AREA_CHANNELS: Record<EngineeringArea, string> = {
  billing: 'billing-finance',
  'technical-support': 'technical-support',
  sales: 'sales-accounts',
  logistics: 'logistics-shipping',
  'product-rnd': 'product-rnd',
  'legal-compliance': 'legal-compliance',
  // Nothing confidently classified goes to the room everyone is in.
  unresolved: 'all-repeat-co',
};

function parseOverrides(raw: string | undefined): Partial<Record<EngineeringArea, string>> {
  if (!raw) return {};
  const out: Partial<Record<EngineeringArea, string>> = {};
  for (const pair of raw.split(',')) {
    const [area, channel] = pair.split('=').map((v) => v.trim());
    if (area && channel && area in DEFAULT_AREA_CHANNELS) {
      out[area as EngineeringArea] = channel.replace(/^#/, '');
    }
  }
  return out;
}

/** The channel that should hear about a complaint in this department. */
export function channelFor(area: EngineeringArea): string {
  const overrides = parseOverrides(process.env.NEXT_PUBLIC_SLACK_AREA_CHANNELS);
  return overrides[area] ?? DEFAULT_AREA_CHANNELS[area] ?? DEFAULT_AREA_CHANNELS.unresolved;
}
