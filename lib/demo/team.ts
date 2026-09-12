import type { EngineeringArea, TeamMember } from '@/types';

/**
 * Team Kanban. Ownership is a function of engineering area, which is why
 * REPEAT can route a bug it has never seen to a person it never observed
 * being assigned.
 */
export const TEAM: TeamMember[] = [
  {
    id: 'noor',
    name: 'Noor',
    role: 'Frontend',
    area: 'frontend',
    handle: '@noor',
    accent: '#38dcff',
  },
  {
    id: 'umar',
    name: 'Umar',
    role: 'Backend',
    area: 'backend',
    handle: '@umar',
    accent: '#8b7cff',
  },
  {
    id: 'awaiz',
    name: 'Awaiz',
    role: 'AI / Data',
    area: 'ai-data',
    handle: '@awaiz',
    accent: '#2dd4a7',
  },
  {
    id: 'huda',
    name: 'Huda',
    role: 'Research / Verification',
    area: 'research',
    handle: '@huda',
    accent: '#f5b544',
  },
  {
    id: 'obaid',
    name: 'Obaid',
    role: 'Operations / Product',
    area: 'operations',
    handle: '@obaid',
    accent: '#ff8fa3',
  },
];

/** area -> owner. The routing table the Ghost Run cites by name. */
export const ROUTING_RULES: Record<EngineeringArea, string | null> = {
  frontend: 'Noor',
  backend: 'Umar',
  'ai-data': 'Awaiz',
  research: 'Huda',
  operations: 'Obaid',
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
