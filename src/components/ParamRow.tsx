/**
 * One parameter row: label, then ± around a value you can tap to type into.
 *
 * No slider here. Giving every parameter its own bar made the record form far
 * too busy — 研磨 keeps one because its scale is a real dial with a fixed range,
 * and that is the only place a bar earns its height.
 *
 * Typing replaces SPEC § 参数留空's tap-to-clear: the field is cleared by
 * emptying the box instead, which is the same gesture people already expect
 * from a text input, and 「全部留空」 still clears the whole group at once.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { color, MIN_TAP } from '@/theme';
import { EditableNumber } from './EditableNumber';
import { Tap, Txt } from './ui';

const REPEAT_DELAY = 380;
const REPEAT_INTERVAL = 70;

export function ParamRow({
  label,
  sub,
  value,
  step,
  min,
  max,
  fallback,
  format,
  /** Unit shown beside the box while typing — raw, so 时间 reads 秒 not mm:ss. */
  editUnit,
  onChange,
}: {
  label: string;
  sub?: string;
  value: number | null;
  step: number;
  min: number;
  max?: number | null;
  /** Where ± starts from when the field is empty. */
  fallback: number | null;
  format: (v: number | null) => string;
  editUnit: string;
  onChange: (v: number | null) => void;
}) {
  // ± repeats while held, so it must read the latest value rather than the one
  // captured when the handler was created.
  const live = useRef(value);
  live.current = value;

  const clamp = (n: number) => {
    const lo = Math.max(min, n);
    const hi = max != null ? Math.min(max, lo) : lo;
    // Kills the drift that 0.5- and 0.1-sized steps accumulate.
    return Math.round(hi * 100) / 100;
  };

  const bump = (dir: -1 | 1) => {
    const current = live.current;
    if (current == null) {
      // SPEC § 参数留空: ± on a cleared field restores the default rather than
      // stepping up from zero.
      onChange(fallback != null ? clamp(fallback) : min);
      return;
    }
    onChange(clamp(current + dir * step));
  };

  return (
    <View style={styles.row}>
      <View style={styles.labelCol}>
        <Txt size={13} c={color.neutral700}>
          {label}
        </Txt>
        {sub ? (
          <Txt size={11.5} c={color.neutral500}>
            {sub}
          </Txt>
        ) : null}
      </View>

      <View style={styles.controls}>
        <RepeatButton sign="−" onStep={() => bump(-1)} />

        <EditableNumber
          value={value}
          format={format}
          unit={editUnit}
          onCommit={(v) => onChange(v == null ? null : clamp(v))}
        />

        <RepeatButton sign="＋" onStep={() => bump(1)} />
      </View>
    </View>
  );
}

/** ± that fires once on tap and repeats while held. */
function RepeatButton({ sign, onStep }: { sign: string; onStep: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // A finger still down when this unmounts would keep the timer firing.
  useEffect(() => stop, []);

  const schedule = () => {
    timer.current = setTimeout(() => {
      onStep();
      schedule();
    }, REPEAT_INTERVAL);
  };

  return (
    <Tap
      onPressIn={() => {
        onStep();
        timer.current = setTimeout(schedule, REPEAT_DELAY);
      }}
      onPressOut={stop}
      style={styles.stepper}
    >
      <Txt size={17} w="semi" c={color.accent700}>
        {sign}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  labelCol: { flex: 1, gap: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepper: {
    width: MIN_TAP,
    height: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
