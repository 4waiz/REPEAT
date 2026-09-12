'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A row of panels the presenter can resize by dragging a corner.
 *
 * Width is a trade, not a push: dragging a corner sideways gives that column
 * the pixels its neighbour gives up, so the row always fills its track and
 * nothing overflows the screen mid-demo. Dragging down sets the row height.
 *
 * The row starts in automatic mode, where the height comes from the caller's
 * classes — including the deliberate shrink when the agent takes the stage,
 * which is what keeps the Execute control above the fold. The first manual
 * drag takes that over; double-clicking any grip (or the Reset control) hands
 * it back. Sizes persist per row so a rehearsal layout survives a reload.
 *
 * Only active at lg and up, where the row is actually side by side.
 */

type Layout = { cols: number[]; height: number | null };

const MIN_COL_FRACTION = 0.14;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 720;

function readStored(key: string, count: number): Layout | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Layout;
    if (!Array.isArray(parsed.cols) || parsed.cols.length !== count) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ResizableRow({
  children,
  storageKey,
  className,
  style,
  activeFrom = 1024,
}: {
  children: React.ReactNode;
  /** Per-row localStorage key, so each row remembers its own layout. */
  storageKey: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Viewport width at which this row is actually side by side. Below it the
   * row stacks and a stored column split would be meaningless, so dragging
   * is off and the caller's own classes drive the layout.
   */
  activeFrom?: number;
}) {
  const panels = React.Children.toArray(children);
  const count = panels.length;

  const rowRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState<Layout | null>(null);
  const [wide, setWide] = React.useState(false);

  // Restore on mount only — reading localStorage during render would break
  // hydration, since the server has no idea what the presenter last dragged.
  React.useEffect(() => {
    setLayout(readStored(storageKey, count));
  }, [storageKey, count]);

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${activeFrom}px)`);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [activeFrom]);

  const persist = React.useCallback(
    (next: Layout | null) => {
      setLayout(next);
      try {
        if (next) window.localStorage.setItem(storageKey, JSON.stringify(next));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* private mode: the layout just will not survive a reload */
      }
    },
    [storageKey],
  );

  const startDrag = (event: React.PointerEvent<HTMLSpanElement>, index: number) => {
    if (!wide) return;
    const row = rowRef.current;
    if (!row) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const items = Array.from(row.children).filter((el) =>
      el.hasAttribute('data-resizable-panel'),
    ) as HTMLElement[];
    const widths = items.map((el) => el.getBoundingClientRect().width);
    const total = widths.reduce((a, b) => a + b, 0);
    const startHeight = row.getBoundingClientRect().height;
    const startX = event.clientX;
    const startY = event.clientY;

    // The corner trades with the next column, except on the last panel,
    // which has no next — there it trades with the one before it.
    const partner = index === count - 1 ? index - 1 : index + 1;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const next = [...widths];
      if (partner >= 0) {
        // Dragging right widens this panel; the last panel is mirrored,
        // because its grip sits on the far side of the pair it trades with.
        const delta = index === count - 1 ? -dx : dx;
        const min = total * MIN_COL_FRACTION;
        const room = Math.min(
          Math.max(delta, min - next[index]),
          next[partner] - min,
        );
        next[index] += room;
        next[partner] -= room;
      }

      persist({
        cols: next.map((w) => w / total),
        height: Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + dy))),
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const active = wide && layout !== null;

  return (
    <div
      ref={rowRef}
      className={cn('group/row relative', className)}
      style={{
        ...style,
        ...(active
          ? {
              // fr, not %, so the column maths stays correct across the gutters.
              gridTemplateColumns: layout!.cols.map((f) => `${f.toFixed(4)}fr`).join(' '),
              ...(layout!.height
                ? { height: `${layout!.height}px`, transitionProperty: 'none' }
                : {}),
            }
          : {}),
      }}
    >
      {panels.map((panel, i) => (
        <div
          key={i}
          data-resizable-panel
          // min-h-0 so the wrapper cannot outgrow its grid track — without it
          // the app row escapes the height clamp that keeps Execute in view.
          className="relative flex min-h-0 min-w-0 flex-col [&>*:first-child]:min-h-0 [&>*:first-child]:flex-1"
        >
          {panel}
          {/* The grip. Invisible until the row is hovered so it never
              competes with the workflow for attention on stage. */}
          <span
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            title="Drag to resize · double-click to reset"
            onPointerDown={(e) => startDrag(e, i)}
            onDoubleClick={() => persist(null)}
            className="absolute -bottom-0.5 -right-0.5 z-20 hidden h-4 w-4 cursor-nwse-resize touch-none items-end justify-end rounded-br-window opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 lg:flex"
          >
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-mist-500" aria-hidden>
              <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      ))}

      {active ? (
        <button
          onClick={() => persist(null)}
          className="absolute -top-5 right-4 z-20 hidden text-3xs uppercase tracking-[0.12em] text-mist-600 transition hover:text-mist-300 group-hover/row:block"
        >
          Reset layout
        </button>
      ) : null}
    </div>
  );
}
