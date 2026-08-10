'use client';

import { useEffect, useRef, useState } from 'react';
import { SMEAR_FASTER, advance, settled, type LineRect, type Point } from '../../lib/reader/cursor';

/**
 * The cursor, with a smear.
 *
 * Two points chase the target: a head that moves almost immediately and a tail
 * that lags. The quad between them is the smear — the further the jump, the
 * longer the streak, which is exactly what makes `gg` read differently from
 * `j`. Positions are in the scroll container's content coordinates, so the
 * cursor scrolls with the prose rather than floating over it.
 */

interface Props {
  block: LineRect | null;
  /** Touch devices have no cursor to move, and reduced motion gets no smear. */
  animated: boolean;
}

export function SmearCursor({ block, animated }: Props) {
  const [head, setHead] = useState<Point | null>(null);
  const [tail, setTail] = useState<Point | null>(null);
  const frame = useRef(0);
  const state = useRef<{ head: Point; tail: Point } | null>(null);

  useEffect(() => {
    if (!block) {
      state.current = null;
      setHead(null);
      setTail(null);
      return;
    }

    const target: Point = { x: block.x, y: block.y };

    // First appearance, or motion disabled: land immediately.
    if (!state.current || !animated) {
      state.current = { head: { ...target }, tail: { ...target } };
      setHead({ ...target });
      setTail({ ...target });
      return;
    }

    const tick = () => {
      const current = state.current;
      if (!current) return;

      current.head = {
        x: advance(current.head.x, target.x, SMEAR_FASTER.stiffness),
        y: advance(current.head.y, target.y, SMEAR_FASTER.stiffness),
      };
      current.tail = {
        x: advance(current.tail.x, target.x, SMEAR_FASTER.trailingStiffness * SMEAR_FASTER.damping),
        y: advance(current.tail.y, target.y, SMEAR_FASTER.trailingStiffness * SMEAR_FASTER.damping),
      };

      setHead({ ...current.head });
      setTail({ ...current.tail });

      if (settled(current.head, current.tail, target, SMEAR_FASTER.distanceStopAnimating)) {
        current.head = { ...target };
        current.tail = { ...target };
        setHead({ ...target });
        setTail({ ...target });
        frame.current = 0;
        return;
      }
      frame.current = window.requestAnimationFrame(tick);
    };

    window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame.current);
  }, [block, animated]);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  if (!block || !head || !tail) return null;

  // The smear is the bounding box of head and tail; when they coincide it
  // collapses to exactly the cursor block and disappears behind it.
  const smearTop = Math.min(head.y, tail.y);
  const smearLeft = Math.min(head.x, tail.x);
  const smearHeight = Math.abs(head.y - tail.y) + block.height;
  const smearWidth = Math.abs(head.x - tail.x) + block.width;
  const streaking = smearHeight > block.height + 1;

  // A zero-size anchor at the scroll container's content origin. Absolutely
  // positioned children of a scroll container scroll with the content, so the
  // cursor stays glued to its line; sizing this wrapper (or clipping it) would
  // cut the cursor off below the first screenful.
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-0">
      {streaking && (
        <div
          className="absolute rounded-full"
          style={{
            top: smearTop,
            left: smearLeft,
            width: smearWidth,
            height: smearHeight,
            background: 'var(--ctp-rosewater)',
            opacity: 0.32,
            filter: 'blur(1px)',
          }}
        />
      )}

      <div
        data-reader-cursor=""
        className="absolute rounded-[2px]"
        style={{
          top: head.y,
          left: head.x,
          width: block.width,
          height: block.height,
          background: 'var(--ctp-rosewater)',
          opacity: 0.9,
        }}
      />
    </div>
  );
}
