/**
 * Track-and-knob slider. Only 研磨 uses one — every parameter having its own
 * bar made the record form far too busy, so the rest are ± plus typing.
 *
 * Absolute rather than relative: touching anywhere on the track jumps the value
 * to that position, which is what makes it faster than ± for a big move.
 */
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { color, shadowSm } from '@/theme';

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  /** null renders an empty track — the field has been cleared. */
  value: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View>(null);

  /**
   * While a drag is in flight the knob renders from here rather than from the
   * `value` prop. Waiting for the parent to re-render would make the knob trail
   * the finger: every move used to re-render the whole record form, and on a
   * fast swipe the JS thread cannot keep up with the touch stream.
   */
  const [dragValue, setDragValue] = useState<number | null>(null);

  /**
   * The track's position on screen, plus the current range.
   *
   * Both live in a ref because the PanResponder is built once. The geometry in
   * particular has to be absolute: `nativeEvent.locationX` is relative to
   * whichever view is under the finger, so as soon as a drag passes over the
   * knob the origin silently changes and the value jumps to near-minimum.
   * Measuring the track in window coordinates and reading `gestureState.moveX`
   * keeps one frame of reference for the whole gesture.
   */
  const geom = useRef({ x: 0, width: 0 });
  const range = useRef({ min, max, step });
  range.current = { min, max, step };

  // The responder closes over these once, so they have to be read indirectly.
  const emit = useRef(onChange);
  emit.current = onChange;

  // Parent updates are coalesced to one per frame; the knob itself is already
  // smooth from local state, so pushing more often only burns render time.
  const pending = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const flush = () => {
    frame.current = null;
    if (pending.current != null) {
      emit.current(pending.current);
      pending.current = null;
    }
  };

  const push = (v: number) => {
    pending.current = v;
    if (frame.current == null) frame.current = requestAnimationFrame(flush);
  };

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      geom.current = { x, width: w };
    });
  };

  const valueAt = (pageX: number): number | null => {
    const { x, width } = geom.current;
    const { min: lo, max: hi, step: st } = range.current;
    if (width <= 0) return null;
    const span = Math.max(hi - lo, 0.0001);
    const ratio = Math.max(0, Math.min(1, (pageX - x) / width));
    const snapped = Math.round((lo + ratio * span) / st) * st;
    const clamped = Math.min(hi, Math.max(lo, snapped));
    return Math.round(clamped * 100) / 100;
  };

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      /**
       * Never hand the gesture over once it has started here.
       *
       * This used to yield whenever |dy| exceeded |dx|, which sounded like a
       * reasonable way to let the surrounding scroll view take a vertical
       * drag. It is not: the scroll view asks at the very start of the gesture,
       * while both deltas are still a pixel or two, and a thumb arcing across
       * the bar is briefly more vertical than horizontal. The scroll view then
       * took the touch, onPanResponderTerminate fired, and the knob snapped
       * back — the drag "disconnecting" partway across.
       *
       * A slider is a deliberate grab on a thin strip, so it keeps the touch
       * for the whole gesture. The cost is that the page cannot be scrolled by
       * starting the drag on the bar itself, which is the normal trade.
       */
      onPanResponderTerminationRequest: () => false,
      // Android: stop the native scroll container from claiming the touch.
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        const v = valueAt(e.nativeEvent.pageX);
        if (v == null) return;
        setDragValue(v);
        push(v);
      },
      onPanResponderMove: (_e, g) => {
        const v = valueAt(g.moveX);
        if (v == null) return;
        setDragValue(v);
        push(v);
      },
      onPanResponderRelease: () => {
        // Land on the exact final value rather than whatever the last frame
        // happened to flush, then hand rendering back to the prop.
        if (frame.current != null) cancelAnimationFrame(frame.current);
        flush();
        setDragValue(null);
      },
      onPanResponderTerminate: () => {
        if (frame.current != null) cancelAnimationFrame(frame.current);
        flush();
        setDragValue(null);
      },
    }),
  );

  const shown = dragValue ?? value;
  const span = Math.max(max - min, 0.0001);
  const pct = shown == null ? 0 : Math.max(0, Math.min(1, (shown - min) / span));
  const empty = shown == null;

  return (
    // The vertical padding widens the touch target well past the visible bar.
    <View style={styles.wrap} {...pan.panHandlers}>
      <View ref={trackRef} style={styles.track} onLayout={measure} collapsable={false}>
        <View
          style={[styles.fill, { width: `${Math.round(pct * 100)}%` }, empty && styles.fillEmpty]}
        />
      </View>
      <View
        style={[styles.knob, { left: `${Math.round(pct * 100)}%` }, empty && styles.knobEmpty]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center', paddingVertical: 16 },
  track: { height: 6, borderRadius: 999, backgroundColor: color.neutral300, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: color.accent },
  fillEmpty: { backgroundColor: 'transparent' },
  knob: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 999,
    backgroundColor: color.neutral100,
    borderWidth: 2,
    borderColor: color.accent,
    ...shadowSm,
  },
  knobEmpty: { borderColor: color.neutral400 },
});
