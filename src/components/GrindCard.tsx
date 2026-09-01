/**
 * 研磨 gets its own card, not a row in the parameter list.
 *
 * SPEC § 研磨刻度: "研磨的交互是一张独立卡片（仅滴滤 + 自制时出现）" — recent-value
 * capsules taken from this grinder's history, a drag bar, ± at both ends, and a
 * big tappable number that clears. The scale is the grinder's, so the same
 * physical setting keeps its own unit forever.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GrindSpec } from '@/domain/grind';
import { clampGrind, grindText } from '@/domain/grind';
import { color, MIN_TAP, radius, shadowSm } from '@/theme';
import { EditableNumber } from './EditableNumber';
import { Slider } from './Slider';
import { Num, Tap, Txt } from './ui';

export function GrindCard({
  spec,
  value,
  grinderName,
  recents,
  onChange,
}: {
  spec: GrindSpec;
  value: number | null;
  grinderName: string;
  /** Up to four past settings on this grinder, most recent first. */
  recents: number[];
  onChange: (v: number | null) => void;
}) {
  const live = useRef(value);
  live.current = value;

  const max = spec.max ?? spec.min + 1;

  const step = (dir: -1 | 1) => {
    // Read through the ref: RepeatButton keeps firing while held, and a stale
    // `value` from the first render would make every repeat land on the same
    // number.
    const current = live.current;
    if (current == null) {
      onChange(spec.def);
      return;
    }
    onChange(clampGrind(current + dir * spec.step, spec));
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Txt size={13} c={color.neutral700}>
          研磨
        </Txt>
        <Txt size={11.5} c={color.neutral500}>
          {grinderName} · 步进 {spec.step}
          {spec.unit}
        </Txt>
      </View>

      {recents.length > 0 ? (
        <View style={styles.recents}>
          <Txt size={12} c={color.neutral600}>
            常用
          </Txt>
          {recents.map((v) => {
            const on = value === v;
            return (
              <Tap
                key={v}
                onPress={() => onChange(v)}
                style={[
                  styles.capsule,
                  { backgroundColor: on ? color.accent : color.neutral100 },
                  { borderColor: on ? color.accent : color.hairline },
                ]}
              >
                <Num size={13} c={on ? color.accent100 : color.text}>
                  {grindText(v, spec.unit, spec.dec)}
                </Num>
              </Tap>
            );
          })}
        </View>
      ) : null}

      <View style={styles.controls}>
        <RepeatButton sign="−" onStep={() => step(-1)} />

        <EditableNumber
          value={value}
          size={30}
          format={(v) => (v == null ? '—' : grindText(v, spec.unit, spec.dec))}
          unit={spec.unit}
          boxStyle={styles.valueBox}
          editBoxStyle={styles.valueBox}
          onCommit={(v) => onChange(v == null ? null : clampGrind(v, spec))}
        />

        <RepeatButton sign="＋" onStep={() => step(1)} />
      </View>

      <Slider
        value={value}
        min={spec.min}
        max={max}
        step={spec.step}
        onChange={(v) => onChange(clampGrind(v, spec))}
      />

      <View style={styles.ends}>
        <Num size={11.5} c={color.neutral500}>
          {grindText(spec.min, spec.unit, spec.dec)}
        </Num>
        <Num size={11.5} c={color.neutral500}>
          {grindText(max, spec.unit, spec.dec)}
        </Num>
      </View>
    </View>
  );
}

/** Same press-and-hold behaviour as the parameter rows' ± buttons. */
function RepeatButton({ sign, onStep }: { sign: string; onStep: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const schedule = () => {
    timer.current = setTimeout(() => {
      onStep();
      schedule();
    }, 70);
  };

  return (
    <Tap
      onPressIn={() => {
        onStep();
        timer.current = setTimeout(schedule, 380);
      }}
      onPressOut={stop}
      style={styles.stepper}
    >
      <Txt size={19} w="semi" c={color.accent700}>
        {sign}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.small,
    padding: 14,
    gap: 12,
    ...shadowSm,
  },
  head: { gap: 2 },
  recents: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  capsule: {
    paddingHorizontal: 11,
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: {
    width: MIN_TAP,
    height: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.neutral200,
  },
  valueBox: {
    flex: 1,
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.number,
  },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
});
