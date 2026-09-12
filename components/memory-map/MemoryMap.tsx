'use client';

import * as React from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { GitPullRequestArrow, Hash, Mail, ScanSearch, UserCheck } from 'lucide-react';
import type { LearnedPattern, PlannedActionStatus } from '@/types';
import { STEP_META, STEP_ORDER } from '@/lib/events/taxonomy';
import { useRepeat } from '@/lib/store/repeat-store';
import { EmptyState } from '@/components/ui/primitives';
import { cn, formatDuration, formatPercent } from '@/lib/utils';

/**
 * Memory Map.
 *
 * The compiled workflow as a graph. Node state tracks the live run, so during
 * execution this is a real progress display rather than a diagram.
 */

type StepNodeData = {
  title: string;
  source: string;
  icon: 'mail' | 'understand' | 'create' | 'assign' | 'notify';
  status: PlannedActionStatus | 'idle';
  confidence?: number;
};

const ICONS = {
  mail: Mail,
  understand: ScanSearch,
  create: GitPullRequestArrow,
  assign: UserCheck,
  notify: Hash,
} as const;

function StepNode({ data }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const Icon = ICONS[d.icon];
  const active = d.status === 'running';
  const done = d.status === 'succeeded';
  const failed = d.status === 'failed';

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} />
      <motion.div
        animate={{
          borderColor: active
            ? 'rgba(56,220,255,0.6)'
            : done
              ? 'rgba(45,212,167,0.4)'
              : failed
                ? 'rgba(255,107,107,0.5)'
                : 'rgba(255,255,255,0.08)',
          boxShadow: active
            ? '0 0 26px -6px rgba(56,220,255,0.6)'
            : done
              ? '0 0 16px -8px rgba(45,212,167,0.5)'
              : '0 0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.4 }}
        className="flex w-[176px] items-center gap-2.5 rounded-lg border bg-ink-800/85 px-3 py-2.5 backdrop-blur-sm"
      >
        <span
          className={cn(
            'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
            active
              ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
              : done
                ? 'border-teal-400/35 bg-teal-400/12 text-teal-300'
                : failed
                  ? 'border-rose-400/40 bg-rose-400/12 text-rose-300'
                  : 'border-edge-soft bg-white/[0.04] text-mist-400',
          )}
        >
          <Icon className="h-3 w-3" />
          {active ? (
            <motion.span
              className="absolute inset-0 rounded-md border border-cyan-400"
              animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
            />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium leading-tight text-mist-100">
            {d.title}
          </span>
          <span className="block truncate text-3xs uppercase tracking-[0.1em] text-mist-600">
            {d.source}
          </span>
        </span>
      </motion.div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { step: StepNode };

export function MemoryMap({ pattern }: { pattern: LearnedPattern | null }) {
  const activeRun = useRepeat((s) => s.activeRun);
  const phase = useRepeat((s) => s.phase);
  const [hovered, setHovered] = React.useState<string | null>(null);

  const { nodes, edges } = React.useMemo(() => {
    if (!pattern) return { nodes: [] as Node[], edges: [] as Edge[] };

    // Map live action status back onto the compiled steps.
    const statusByStep = new Map<string, PlannedActionStatus>();
    if (activeRun && (phase === 'executing' || phase === 'completed' || phase === 'error')) {
      for (const a of activeRun.proposedActions) {
        const prev = statusByStep.get(a.stepId);
        // A step is running if any of its actions is; failed beats succeeded.
        const rank: Record<string, number> = {
          planned: 0,
          skipped: 1,
          succeeded: 2,
          running: 3,
          needs_review: 4,
          failed: 5,
        };
        if (!prev || rank[a.status] > rank[prev]) statusByStep.set(a.stepId, a.status);
      }
    }

    const nodes: Node[] = pattern.steps.map((step, i) => {
      const key = step.id.replace('step_', '') as (typeof STEP_ORDER)[number];
      return {
        id: step.id,
        type: 'step',
        position: { x: 14, y: i * 74 },
        data: {
          title: STEP_META[key].title,
          source: STEP_META[key].source,
          // Both mail steps wear the mail icon; the rest are named for their step.
          icon: key === 'read' || key === 'reply' ? 'mail' : key,
          status: statusByStep.get(step.id) ?? 'idle',
        } satisfies StepNodeData as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      };
    });

    const edges: Edge[] = pattern.steps.slice(0, -1).map((step, i) => {
      const target = pattern.steps[i + 1];
      const sourceStatus = statusByStep.get(step.id);
      const targetStatus = statusByStep.get(target.id);
      const isActive = targetStatus === 'running';
      const isDone = sourceStatus === 'succeeded' && targetStatus === 'succeeded';
      return {
        id: `${step.id}-${target.id}`,
        source: step.id,
        target: target.id,
        type: 'smoothstep',
        animated: isActive,
        className: isActive ? 'is-active' : isDone ? 'is-done' : '',
        data: { from: STEP_META[step.id.replace('step_', '') as 'read'].title },
      };
    });

    return { nodes, edges };
  }, [pattern, activeRun, phase]);

  if (!pattern) {
    return (
      <EmptyState
        icon={<ScanSearch />}
        title="No workflow learned yet"
        detail="Once REPEAT recognises a repeated workflow, its compiled shape appears here."
      />
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        onEdgeMouseEnter={(_, edge) => setHovered(edge.id)}
        onEdgeMouseLeave={() => setHovered(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(255,255,255,0.055)" />
      </ReactFlow>

      {/* edge detail on hover */}
      {hovered ? (
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg border border-edge bg-ink-800/95 px-2.5 py-2 shadow-lift backdrop-blur-xl">
          <div className="text-3xs uppercase tracking-[0.12em] text-mist-500">
            {hovered.replace('step_', '').replace('-step_', ' → ')}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-3xs text-mist-400">
            <span>
              Observed <span className="text-mist-200">{pattern.observations}×</span>
            </span>
            <span>
              Confidence{' '}
              <span className="text-mist-200">{formatPercent(pattern.confidence)}</span>
            </span>
            <span>
              Manual cost{' '}
              <span className="text-mist-200">
                {formatDuration(pattern.manualDurationSeconds)}
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
