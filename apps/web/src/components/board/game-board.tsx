'use client';

import type { GameState } from '@dots/game-engine';
import { Shrink } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ShapePath } from '@/components/game/player-shape';
import type { MoveEvent } from '@/controllers/types';
import {
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
import { inkOn, shapeForIndex, surfaceEdge, surfaceShade } from '@/lib/players';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  state: GameState;
  /** Whether the local user may draw a line right now. */
  interactive: boolean;
  pendingEdgeId: string | null;
  lastEvent: MoveEvent | null;
  onSelect(edgeId: string): void;
  /** Pulse boxes that have three sides drawn (on the local player's turn). */
  showHints?: boolean;
  /** CSS length the board's height must not exceed. */
  maxHeight?: string;
  className?: string;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Design reference width of the board in CSS pixels. */
const BOARD_PX = 326;

/** Furthest the board can be pinched in. */
const MAX_ZOOM = 3;
/** Boards this big show a one-time "Pinch to zoom" hint on touch screens. */
const ZOOM_HINT_DOTS = 9;
const ZOOM_LEARNED_KEY = 'dotsnatch:zoom-learned';

/** Board zoom: a scale and a pan offset in CSS pixels, applied as a transform. */
interface Zoom {
  scale: number;
  x: number;
  y: number;
}
const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };

/** Keep the zoom in range and the board covering the whole viewport. */
function clampZoom(z: Zoom, width: number, height: number): Zoom {
  const scale = clamp(z.scale, 1, MAX_ZOOM);
  if (scale === 1) return NO_ZOOM;
  return { scale, x: clamp(z.x, width * (1 - scale), 0), y: clamp(z.y, height * (1 - scale), 0) };
}

/** Zoom to `scale`, moving the board point that was under `from` (at `start`) to `to`. */
function zoomAround(start: Zoom, from: Point, to: Point, scale: number): Zoom {
  const px = (from.x - start.x) / start.scale;
  const py = (from.y - start.y) / start.scale;
  return { scale, x: to.x - px * scale, y: to.y - py * scale };
}

/** A client point relative to an element's top-left corner. */
function relativeTo(el: HTMLElement, clientX: number, clientY: number): Point {
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function rememberZoomLearned() {
  try {
    localStorage.setItem(ZOOM_LEARNED_KEY, '1');
  } catch {
    // storage unavailable
  }
}

/**
 * SVG board. Rendering only — every rule decision comes from the GameState.
 * Pointer input uses nearest-edge hit-testing over the whole board so taps need
 * not be precise; each available edge is also a focusable button for keyboard
 * and screen-reader users. One finger draws; two fingers pinch to zoom and pan
 * (trackpad pinch or ctrl + wheel on desktop). Remount it per game to reset the zoom.
 */
export const GameBoard = memo(function GameBoard({
  state,
  interactive,
  pendingEdgeId,
  lastEvent,
  onSelect,
  showHints = true,
  maxHeight = '100dvh',
  className,
}: GameBoardProps) {
  const size = useMemo(() => ({ rows: state.rows, columns: state.columns }), [state.rows, state.columns]);
  const { width, height } = viewBoxSize(size);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const zoomRef = useRef(zoom);
  /** Touch points currently down, in client coordinates. */
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; mid: Point; start: Zoom } | null>(null);
  const [zoomHint, setZoomHint] = useState(false);
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

  // The board keeps its aspect ratio, so its on-screen box (zoom included) maps
  // straight onto the viewBox.
  const toSvgPoint = (event: PointerEvent): Point | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  };

  const applyZoom = useCallback((next: Zoom) => {
    const el = viewportRef.current;
    if (!el) return;
    const z = clampZoom(next, el.clientWidth, el.clientHeight);
    zoomRef.current = z;
    setZoom(z);
  }, []);

  const pinchGeometry = () => {
    const [a, b] = [...touches.current.values()];
    return {
      distance: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)),
      mid: relativeTo(viewportRef.current!, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2),
    };
  };

  const startPinch = () => {
    // A second finger turns the press into a pinch; nothing gets drawn.
    pressing.current = false;
    setPreview(null);
    setZoomHint(false);
    rememberZoomLearned();
    pinch.current = { ...pinchGeometry(), start: zoomRef.current };
  };

  const movePinch = () => {
    const start = pinch.current;
    if (!start || touches.current.size < 2) return;
    const { distance, mid } = pinchGeometry();
    applyZoom(zoomAround(start.start, start.mid, mid, start.start.scale * (distance / start.distance)));
  };

  const releaseTouch = (event: PointerEvent) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size === 0) pinch.current = null;
  };

  // Trackpad pinches (and ctrl + wheel) zoom; once zoomed, the wheel pans.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const z = zoomRef.current;
      if (!event.ctrlKey && z.scale === 1) return;
      event.preventDefault();
      if (event.ctrlKey) {
        const at = relativeTo(el, event.clientX, event.clientY);
        const delta = clamp(event.deltaY, -50, 50);
        applyZoom(zoomAround(z, at, at, z.scale * Math.exp(-delta * 0.01)));
      } else {
        applyZoom({ ...z, x: z.x - event.deltaX, y: z.y - event.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  // Teach pinch-to-zoom once, on big boards on touch screens.
  useEffect(() => {
    if (state.rows < ZOOM_HINT_DOTS && state.columns < ZOOM_HINT_DOTS) return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    try {
      if (localStorage.getItem(ZOOM_LEARNED_KEY) === '1') return;
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoomHint(true);
    const t = setTimeout(() => setZoomHint(false), 3500);
    return () => clearTimeout(t);
  }, [state.rows, state.columns]);

  /** Pan a keyboard-focused line into view when zoomed in. */
  const revealEdge = (id: string) => {
    const z = zoomRef.current;
    const el = viewportRef.current;
    const m = edgeMidpoint(id, size);
    if (z.scale === 1 || !el || !m) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const bx = (m.x / width) * w * z.scale;
    const by = (m.y / height) * h * z.scale;
    const margin = Math.min(w, h) * 0.12;
    const px = bx + z.x;
    const py = by + z.y;
    if (px >= margin && px <= w - margin && py >= margin && py <= h - margin) return;
    applyZoom({ ...z, x: w / 2 - bx, y: h / 2 - by });
  };

  const hit = (event: PointerEvent) => {
    const point = toSvgPoint(event);
    return point ? nearestEdge(point, size, isAvailable) : null;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    usingKeyboard.current = false;
    if (event.pointerType !== 'mouse') {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      // Keep receiving this finger's moves even if it leaves the board mid-pinch.
      event.currentTarget.setPointerCapture(event.pointerId);
      if (touches.current.size === 2) return startPinch();
      // Extra fingers, or a finger left down after a pinch, never draw.
      if (pinch.current || touches.current.size > 2) return;
    }
    if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const id = hit(event);
    if (!id) return;
    pressing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreview(id);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinch.current) return movePinch();
    if (!interactive) return;
    // Hover preview for mice; drag-to-adjust for touch and pen.
    if (pressing.current || event.pointerType === 'mouse') setPreview(hit(event));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const wasPinching = pinch.current !== null;
    releaseTouch(event);
    if (wasPinching || !pressing.current) return;
    pressing.current = false;
    const id = hit(event);
    // Commit what is previewed at release; releasing away from any line cancels.
    if (id && interactive) onSelect(id);
    setPreview(event.pointerType === 'mouse' ? id : null);
  };

  const cancelPress = (event: PointerEvent) => {
    releaseTouch(event);
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

  // Stroke sizes follow the design: clamped in screen pixels for a ~326px board.
  const unitsPerPx = width / BOARD_PX;
  const spacingPx = SPACING / unitsPerPx;
  // The minimums shrink on very large boards so lines and dots don't crowd the boxes.
  const lineWidth = clamp(spacingPx * 0.12, Math.min(4, spacingPx * 0.16), 9) * unitsPerPx;
  const dotRadius = clamp(spacingPx * 0.09, Math.min(4.5, spacingPx * 0.18), 8.5) * unitsPerPx;
  const inset = lineWidth * 0.5 + 2.5 * unitsPerPx;
  const boxSize = SPACING - inset * 2;
  const boxRadius = Math.min(14 * unitsPerPx, boxSize * 0.22);

  const previewId = interactive ? preview : null;
  const previewSeg = previewId ? edgeSegment(previewId, size) : null;
  const focusRingId = focusVisible ? rovingId : null;
  const isEndpoint = (x: number, y: number) =>
    previewSeg?.some((p) => p.x === x && p.y === y) ?? false;

  const zoomed = zoom.scale > 1;

  return (
    <div
      ref={viewportRef}
      className={cn('@container relative mx-auto', zoomed && 'overflow-hidden rounded-[18px]', className)}
      style={{
        aspectRatio: `${width} / ${height}`,
        width: `min(100%, calc(${maxHeight} * ${width / height}))`,
      }}
    >
      <div
        className="relative size-full origin-top-left"
        style={zoomed ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` } : undefined}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="block size-full touch-none overflow-visible select-none"
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
          {/* Available edges: faint guides */}
          <g stroke="#EEE6F6" strokeWidth={lineWidth * 0.6} strokeLinecap="round">
            {availableIds.map((id) => {
              const seg = edgeSegment(id, size)!;
              return <line key={id} x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y} />;
            })}
          </g>

          {/* Cells: owner colour + shape, and a pulsing hint on boxes one line from capture */}
          <g>
            {Object.values(state.cells).map((cell) => {
              const { x: cx, y: cy } = dotPosition(cell.row, cell.column);
              const x = cx + inset;
              const y = cy + inset;
              if (!cell.ownerId) {
                if (!interactive || !current || !showHints) return null;
                const sides = [cell.top, cell.right, cell.bottom, cell.left].filter(
                  (id) => state.edges[id]?.claimedBy !== undefined,
                ).length;
                if (sides !== 3) return null;
                return (
                  <rect
                    key={cell.id}
                    x={x}
                    y={y}
                    width={boxSize}
                    height={boxSize}
                    rx={boxRadius}
                    fill={current.color}
                    opacity={0.12}
                    className="animate-[bh-pulse_1.1s_ease-in-out_infinite]"
                    pointerEvents="none"
                  />
                );
              }
              const index = playerIndex.get(cell.ownerId) ?? 0;
              const color = state.players[index]?.color ?? '#2B1B4A';
              return (
                <g
                  key={cell.id}
                  className="animate-[bh-cell_.5s_cubic-bezier(.3,1.6,.5,1)]"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  pointerEvents="none"
                >
                  <rect x={x} y={y} width={boxSize} height={boxSize} rx={boxRadius} fill={color} />
                  <rect
                    x={x + boxSize * 0.12}
                    y={y + boxSize * 0.1}
                    width={boxSize * 0.35}
                    height={boxSize * 0.12}
                    rx={boxSize * 0.06}
                    fill="#fff"
                    opacity={0.35}
                  />
                  <ShapePath
                    shape={shapeForIndex(index)}
                    cx={x + boxSize / 2}
                    cy={y + boxSize / 2}
                    r={boxSize * 0.17}
                    fill={inkOn(color)}
                  />
                </g>
              );
            })}
          </g>

          {/* Claimed edges */}
          <g strokeLinecap="round" pointerEvents="none">
            {edges.map((edge) => {
              if (edge.claimedBy === undefined) return null;
              const seg = edgeSegment(edge.id, size)!;
              const color = state.players[playerIndex.get(edge.claimedBy) ?? 0]?.color ?? '#2B1B4A';
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
                      strokeOpacity={0.28}
                      strokeWidth={lineWidth * 2.8}
                    />
                  )}
                  <line
                    x1={seg[0].x}
                    y1={seg[0].y}
                    x2={seg[1].x}
                    y2={seg[1].y}
                    stroke={color}
                    strokeWidth={lineWidth}
                    pathLength={1}
                    strokeDasharray={1}
                    className="animate-[bh-draw_.22s_ease-out]"
                  />
                </g>
              );
            })}
          </g>

          {/* Pending (submitted, awaiting server) */}
          {pendingEdgeId && current && (
            <PendingLine id={pendingEdgeId} size={size} color={current.color} width={lineWidth} />
          )}

          {/* Preview */}
          {previewSeg && current && (
            <line
              x1={previewSeg[0].x}
              y1={previewSeg[0].y}
              x2={previewSeg[1].x}
              y2={previewSeg[1].y}
              stroke={current.color}
              strokeOpacity={0.5}
              strokeWidth={lineWidth}
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}

          {/* Keyboard focus ring */}
          {focusRingId && (() => {
            const seg = edgeSegment(focusRingId, size)!;
            return (
              <line
                x1={seg[0].x}
                y1={seg[0].y}
                x2={seg[1].x}
                y2={seg[1].y}
                stroke="#7B5CFF"
                strokeWidth={lineWidth * 2.4}
                strokeLinecap="round"
                strokeOpacity={0.7}
                fill="none"
                pointerEvents="none"
              />
            );
          })()}

          {/* Dots (the preview's endpoints grow in the mover's colour) */}
          <g pointerEvents="none">
            {Array.from({ length: state.rows }, (_, r) =>
              Array.from({ length: state.columns }, (_, c) => {
                const { x, y } = dotPosition(r, c);
                const on = isEndpoint(x, y);
                return (
                  <circle
                    key={`${r}-${c}`}
                    cx={x}
                    cy={y}
                    r={on ? dotRadius * 1.4 : dotRadius}
                    fill={on && current ? current.color : '#2B1B4A'}
                    style={{ transition: 'r .15s, fill .15s' }}
                  />
                );
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
                    revealEdge(id);
                  }}
                  onBlur={() => setFocusVisible(false)}
                />
              );
            })}
          </g>
        </svg>
        <CaptureEffects state={state} lastEvent={lastEvent} width={width} height={height} />
      </div>
      {zoomed && (
        <button
          type="button"
          onClick={() => applyZoom(NO_ZOOM)}
          aria-label="Fit board to screen"
          className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_3px_0_#EADFCB]"
        >
          <Shrink className="size-5" aria-hidden />
        </button>
      )}
      {zoomHint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-3.5 py-1.5 text-sm font-extrabold whitespace-nowrap text-white animate-[bh-rise_.4s_ease-out]"
        >
          Pinch to zoom
        </div>
      )}
    </div>
  );
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface Burst {
  id: string;
  x: number;
  y: number;
  color: string;
  seed: number;
}

interface Flash {
  id: number;
  text: string;
  color: string;
}

/**
 * Celebration layer over the board: a ring, confetti burst and "+1" on each
 * captured box, plus a tilted callout (NICE! / DOUBLE! / COMBO ×3).
 * Purely decorative, so it is hidden from assistive technology.
 */
function CaptureEffects({
  state,
  lastEvent,
  width,
  height,
}: {
  state: GameState;
  lastEvent: MoveEvent | null;
  width: number;
  height: number;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const seen = useRef<number | null>(lastEvent?.id ?? null);
  const combo = useRef({ playerId: '', count: 0 });

  useEffect(() => {
    if (!lastEvent || lastEvent.id === seen.current) return;
    seen.current = lastEvent.id;
    const captured = lastEvent.completedCells.length;
    if (!captured) {
      combo.current = { playerId: lastEvent.playerId, count: 0 };
      return;
    }
    const streak = combo.current.playerId === lastEvent.playerId ? combo.current.count + captured : captured;
    combo.current = { playerId: lastEvent.playerId, count: streak };
    const color = state.players.find((p) => p.id === lastEvent.playerId)?.color ?? '#FF3D7F';

    const fresh = lastEvent.completedCells.flatMap((cellId) => {
      const cell = state.cells[cellId];
      if (!cell) return [];
      const { x, y } = dotPosition(cell.row, cell.column);
      return [{ id: `${lastEvent.id}-${cellId}`, x: x + SPACING / 2, y: y + SPACING / 2, color, seed: Math.random() * 6 }];
    });
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBursts((prev) => [...prev.slice(-24), ...fresh]);
    timers.push(setTimeout(() => setBursts((prev) => prev.filter((b) => !fresh.includes(b))), 1000));

    if (!lastEvent.gameOver) {
      const text =
        captured === 2
          ? 'DOUBLE!'
          : streak >= 5
            ? `ON FIRE ×${streak}`
            : streak >= 3
              ? `COMBO ×${streak}`
              : 'NICE!';
      const next = { id: lastEvent.id, text, color };
      setFlash(next);
      timers.push(setTimeout(() => setFlash((f) => (f?.id === next.id ? null : f)), 1200));
    }
    return () => timers.forEach(clearTimeout);
  }, [lastEvent, state]);

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const boxPx = (SPACING / width) * 100;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {bursts.map((b) => (
        <div key={b.id} className="absolute size-0" style={{ left: pct(b.x, width), top: pct(b.y, height) }}>
          <div
            className="absolute top-0 left-0 box-border rounded-full animate-[bh-ring_.6s_ease-out_forwards]"
            style={{ width: `${boxPx * 0.9}cqw`, height: `${boxPx * 0.9}cqw`, border: `4px solid ${b.color}` }}
          />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2 + b.seed;
            const distance = 36 + (i % 3) * 16;
            const big = i % 3 === 0;
            return (
              <span
                key={i}
                className="absolute top-0 left-0 animate-[bh-burst_.75s_cubic-bezier(.2,.8,.3,1)_forwards]"
                style={
                  {
                    width: big ? 11 : 8,
                    height: big ? 11 : 8,
                    borderRadius: i % 2 ? '50%' : 3,
                    background: i % 4 === 0 ? '#FFD84D' : b.color,
                    '--dx': `${Math.cos(angle) * distance}px`,
                    '--dy': `${Math.sin(angle) * distance}px`,
                  } as React.CSSProperties
                }
              />
            );
          })}
          <div
            className="absolute top-0 left-0 font-display text-[26px] leading-none font-extrabold whitespace-nowrap opacity-0 animate-[bh-float_.9s_ease-out_forwards]"
            style={{ color: b.color, textShadow: '0 2px 0 #fff, 0 -2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff' }}
          >
            +1
          </div>
        </div>
      ))}
      {flash && (
        <div
          key={flash.id}
          className="absolute top-1/2 left-1/2 rounded-[18px] px-[22px] py-2.5 font-display text-[34px] leading-none font-extrabold whitespace-nowrap animate-[bh-flash_1.1s_ease-out_forwards]"
          style={{
            transform: 'translate(-50%,-50%) rotate(-4deg)',
            background: surfaceShade(flash.color),
            color: inkOn(flash.color),
            boxShadow: `0 6px 0 ${surfaceEdge(flash.color)}, 0 18px 30px -8px rgba(43,27,74,.4)`,
          }}
        >
          {flash.text}
        </div>
      )}
    </div>
  );
}

function PendingLine({ id, size, color, width }: { id: string; size: { rows: number; columns: number }; color: string; width: number }) {
  const seg = edgeSegment(id, size);
  if (!seg) return null;
  return (
    <motion.line
      x1={seg[0].x}
      y1={seg[0].y}
      x2={seg[1].x}
      y2={seg[1].y}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      animate={{ strokeOpacity: [0.3, 0.8, 0.3] }}
      transition={{ duration: 0.9, repeat: Infinity }}
      pointerEvents="none"
    />
  );
}
