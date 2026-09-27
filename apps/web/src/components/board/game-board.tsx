'use client';

import type { GameState } from '@dots/game-engine';
import { motion } from 'motion/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ShapePath } from '@/components/game/player-shape';
import type { MoveEvent } from '@/controllers/types';
import {
  PADDING,
  SPACING,
  describeEdge,
  dotPosition,
  edgeInDirection,
  edgeMidpoint,
  edgeSegment,
  nearestEdge,
  viewBoxSize,
} from '@/lib/board-geometry';
import type { Direction, Point } from '@/lib/board-geometry';
import { shapeForIndex } from '@/lib/players';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  state: GameState;
  /** Whether the local user may draw a line right now. */
  interactive: boolean;
  pendingEdgeId: string | null;
  lastEvent: MoveEvent | null;
  onSelect(edgeId: string): void;
  className?: string;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const LINE_WIDTH = 10;
const DOT_RADIUS = 8;

/**
 * SVG board. Rendering only — every rule decision comes from the GameState.
 * Pointer input uses nearest-edge hit-testing over the whole board so taps need
 * not be precise; each available edge is also a focusable button for keyboard
 * and screen-reader users.
 */
export const GameBoard = memo(function GameBoard({
  state,
  interactive,
  pendingEdgeId,
  lastEvent,
  onSelect,
  className,
}: GameBoardProps) {
  const size = useMemo(() => ({ rows: state.rows, columns: state.columns }), [state.rows, state.columns]);
  const { width, height } = viewBoxSize(size);
  const svgRef = useRef<SVGSVGElement>(null);
  const pressing = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);

  const playerIndex = useMemo(
    () => new Map(state.players.map((p, i) => [p.id, i])),
    [state.players],
  );
  const current = state.players[state.currentPlayerIndex];
  const edges = useMemo(() => Object.values(state.edges), [state.edges]);
  const availableIds = useMemo(
    () => edges.filter((e) => e.claimedBy === undefined && e.id !== pendingEdgeId).map((e) => e.id),
    [edges, pendingEdgeId],
  );
  const isAvailable = useCallback(
    (id: string) => state.edges[id] !== undefined && state.edges[id]!.claimedBy === undefined && id !== pendingEdgeId,
    [state.edges, pendingEdgeId],
  );

  // The roving keyboard target: the focused edge, or the nearest available one
  // once the focused edge has been claimed.
  const rovingId = useMemo(() => {
    if (focused === null) return null;
    if (availableIds.includes(focused)) return focused;
    const from = edgeMidpoint(focused, size);
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const id of availableIds) {
      const m = edgeMidpoint(id, size);
      if (!m || !from) continue;
      const d = Math.hypot(m.x - from.x, m.y - from.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = id;
      }
    }
    return best;
  }, [focused, availableIds, size]);

  // Keyboard users keep focus on the board as lines disappear.
  const usingKeyboard = useRef(false);
  useEffect(() => {
    if (!usingKeyboard.current || !rovingId) return;
    if (document.activeElement?.getAttribute('data-edge') !== rovingId) focusEdge(rovingId);
  }, [rovingId]);

  const toSvgPoint = (event: PointerEvent): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const hit = (event: PointerEvent) => {
    const point = toSvgPoint(event);
    return point ? nearestEdge(point, size, isAvailable) : null;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    usingKeyboard.current = false;
    if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const id = hit(event);
    if (!id) return;
    pressing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreview(id);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    // Hover preview for mice; drag-to-adjust for touch and pen.
    if (pressing.current || event.pointerType === 'mouse') setPreview(hit(event));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!pressing.current) return;
    pressing.current = false;
    const id = hit(event);
    // Commit what is previewed at release; releasing away from any line cancels.
    if (id && interactive) onSelect(id);
    setPreview(event.pointerType === 'mouse' ? id : null);
  };

  const cancelPress = () => {
    pressing.current = false;
    setPreview(null);
  };

  function focusEdge(id: string) {
    svgRef.current?.querySelector<SVGElement>(`[data-edge="${id}"]`)?.focus();
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    usingKeyboard.current = true;
    const from = rovingId ?? availableIds[0];
    if (!from) return;
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      const next = edgeInDirection(from, direction, size, availableIds);
      if (next) {
        setFocused(next);
        focusEdge(next);
      }
    } else if ((event.key === 'Enter' || event.key === ' ') && interactive) {
      event.preventDefault();
      onSelect(from);
    }
  };

  const cellShapeSize = SPACING * 0.18;
  const previewId = interactive ? preview : null;
  const focusRingId = focusVisible ? rovingId : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block h-auto w-full touch-none select-none', className)}
      role="group"
      aria-label={`Game board, ${state.rows} by ${state.columns} dots. ${
        interactive ? 'Use arrow keys to choose a line and Enter to draw it.' : 'Waiting for another player.'
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelPress}
      onPointerLeave={() => !pressing.current && setPreview(null)}
      onKeyDown={onKeyDown}
    >
      <rect
        x={PADDING / 3}
        y={PADDING / 3}
        width={width - (PADDING * 2) / 3}
        height={height - (PADDING * 2) / 3}
        rx={24}
        className="fill-card"
      />

      {/* Cells */}
      <g>
        {Object.values(state.cells).map((cell) => {
          if (!cell.ownerId) return null;
          const index = playerIndex.get(cell.ownerId) ?? 0;
          const color = state.players[index]?.color ?? 'currentColor';
          const { x, y } = dotPosition(cell.row, cell.column);
          const fresh = lastEvent?.completedCells.includes(cell.id) ?? false;
          return (
            <motion.g
              key={cell.id}
              initial={fresh ? { opacity: 0, scale: 0.4 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              style={{ transformOrigin: `${x + SPACING / 2}px ${y + SPACING / 2}px` }}
            >
              <rect
                x={x + 7}
                y={y + 7}
                width={SPACING - 14}
                height={SPACING - 14}
                rx={12}
                fill={color}
                fillOpacity={0.2}
              />
              <ShapePath
                shape={shapeForIndex(index)}
                cx={x + SPACING / 2}
                cy={y + SPACING / 2}
                r={cellShapeSize}
                fill={color}
                fillOpacity={0.85}
              />
            </motion.g>
          );
        })}
      </g>

      {/* Available edges: faint guides */}
      <g className="stroke-muted-foreground" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" strokeDasharray="1 9">
        {availableIds.map((id) => {
          const seg = edgeSegment(id, size)!;
          return <line key={id} x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y} />;
        })}
      </g>

      {/* Claimed edges */}
      <g strokeLinecap="round">
        {edges.map((edge) => {
          if (edge.claimedBy === undefined) return null;
          const seg = edgeSegment(edge.id, size)!;
          const color = state.players[playerIndex.get(edge.claimedBy) ?? 0]?.color ?? 'currentColor';
          const isLast = lastEvent?.edgeId === edge.id;
          return (
            <g key={edge.id}>
              {isLast && (
                <line
                  x1={seg[0].x}
                  y1={seg[0].y}
                  x2={seg[1].x}
                  y2={seg[1].y}
                  stroke={color}
                  strokeOpacity={0.25}
                  strokeWidth={LINE_WIDTH * 2.4}
                />
              )}
              <motion.line
                x1={seg[0].x}
                y1={seg[0].y}
                x2={seg[1].x}
                y2={seg[1].y}
                stroke={color}
                strokeWidth={LINE_WIDTH}
                initial={isLast ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              />
            </g>
          );
        })}
      </g>

      {/* Pending (submitted, awaiting server) */}
      {pendingEdgeId && current && (
        <PendingLine id={pendingEdgeId} size={size} color={current.color} />
      )}

      {/* Preview */}
      {previewId && current && (() => {
        const seg = edgeSegment(previewId, size)!;
        return (
          <line
            x1={seg[0].x}
            y1={seg[0].y}
            x2={seg[1].x}
            y2={seg[1].y}
            stroke={current.color}
            strokeOpacity={0.45}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            pointerEvents="none"
          />
        );
      })()}

      {/* Keyboard focus ring */}
      {focusRingId && (() => {
        const seg = edgeSegment(focusRingId, size)!;
        return (
          <line
            x1={seg[0].x}
            y1={seg[0].y}
            x2={seg[1].x}
            y2={seg[1].y}
            className="stroke-ring"
            strokeWidth={LINE_WIDTH * 2.2}
            strokeLinecap="round"
            strokeOpacity={0.8}
            fill="none"
            pointerEvents="none"
          />
        );
      })()}

      {/* Dots */}
      <g className="fill-foreground" pointerEvents="none">
        {Array.from({ length: state.rows }, (_, r) =>
          Array.from({ length: state.columns }, (_, c) => {
            const { x, y } = dotPosition(r, c);
            return <circle key={`${r}-${c}`} cx={x} cy={y} r={DOT_RADIUS} />;
          }),
        )}
      </g>

      {/* Focusable edge buttons (keyboard + screen readers) */}
      <g>
        {availableIds.map((id, i) => {
          const seg = edgeSegment(id, size)!;
          const tabbable = rovingId ? id === rovingId : i === 0;
          return (
            <line
              key={id}
              data-edge={id}
              x1={seg[0].x}
              y1={seg[0].y}
              x2={seg[1].x}
              y2={seg[1].y}
              stroke="transparent"
              strokeWidth={SPACING * 0.3}
              pointerEvents="none"
              role="button"
              tabIndex={tabbable ? 0 : -1}
              aria-disabled={!interactive}
              aria-label={`${describeEdge(id, size)}, available`}
              className="outline-none"
              onFocus={() => {
                setFocused(id);
                setFocusVisible(true);
              }}
              onBlur={() => setFocusVisible(false)}
            />
          );
        })}
      </g>
    </svg>
  );
});

function PendingLine({ id, size, color }: { id: string; size: { rows: number; columns: number }; color: string }) {
  const seg = edgeSegment(id, size);
  if (!seg) return null;
  return (
    <motion.line
      x1={seg[0].x}
      y1={seg[0].y}
      x2={seg[1].x}
      y2={seg[1].y}
      stroke={color}
      strokeWidth={LINE_WIDTH}
      strokeLinecap="round"
      animate={{ strokeOpacity: [0.3, 0.8, 0.3] }}
      transition={{ duration: 0.9, repeat: Infinity }}
      pointerEvents="none"
    />
  );
}
