/**
 * 选时间 sheet — three snapping columns (date / hour / minute).
 *
 * SPEC § 时间: 今天 / 昨天 then back 60 days with correct month rollover,
 * minutes in 5-minute steps, 「现在」 top-left, 「完成」 top-right, and no future
 * times. The prototype faked the wheel in HTML; here each column is a real
 * snapping ScrollView, so it carries iOS inertia for free.
 */
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { color, radius } from '@/theme';
import { Sheet } from './Sheet';
import { NavAction } from './Screen';
import { Num, Txt } from './ui';

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const DAYS_BACK = 60;
/**
 * How long the wheel has to stop moving before its row counts as chosen.
 *
 * The obvious hook is `onMomentumScrollEnd`, and that is what this used to use
 * — but react-native-web never fires it (the DOM has no such event), so on the
 * web the wheel scrolled and nothing was ever selected. Watching `onScroll` go
 * quiet works on both platforms, and it is also what makes the row snap: web
 * ignores `snapToInterval` too.
 */
const SETTLE_MS = 140;

export type TimeValue = { dayOffset: number; hour: number; minute: number };

/** The concrete Date a TimeValue points at, relative to `now`. */
export const resolveTime = (v: TimeValue, now: Date): Date => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - v.dayOffset);
  d.setHours(v.hour, v.minute, 0, 0);
  return d;
};

/** Nearest valid TimeValue for a Date — used when editing an existing record. */
export const toTimeValue = (when: Date, now: Date): TimeValue => {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  return {
    dayOffset: Math.round((a.getTime() - b.getTime()) / 86_400_000),
    hour: when.getHours(),
    minute: Math.round(when.getMinutes() / 5) * 5 === 60 ? 55 : Math.round(when.getMinutes() / 5) * 5,
  };
};

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const dayOptionLabel = (offset: number, now: Date): string => {
  if (offset === 0) return '今天';
  if (offset === 1) return '昨天';
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WD[d.getDay()]}`;
};

export function TimeSheet({
  visible,
  value,
  now,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: TimeValue;
  /** Captured when the form opened — SPEC: 每次打开表单重取当前时间. */
  now: Date;
  onChange: (v: TimeValue) => void;
  onClose: () => void;
}) {
  const days = useMemo(
    () => Array.from({ length: DAYS_BACK + 1 }, (_, i) => ({ v: i, label: dayOptionLabel(i, now) })),
    [now],
  );
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ v: i, label: String(i).padStart(2, '0') })),
    [],
  );
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ v: i * 5, label: String(i * 5).padStart(2, '0') })),
    [],
  );

  /** SPEC: 不能选未来. Only today's later hours/minutes can be in the future. */
  const clampToNow = (next: TimeValue): TimeValue => {
    if (next.dayOffset > 0) return next;
    if (next.hour > now.getHours()) return { ...next, hour: now.getHours(), minute: Math.floor(now.getMinutes() / 5) * 5 };
    if (next.hour === now.getHours() && next.minute > now.getMinutes()) {
      return { ...next, minute: Math.floor(now.getMinutes() / 5) * 5 };
    }
    return next;
  };

  /**
   * The last value handed out, which is not always the last one rendered.
   *
   * Each column commits from a timer, and two columns flicked in quick
   * succession can both fire before React has re-rendered with the first
   * result. Building the patch on `value` there would make the second pick
   * overwrite the first with a stale base — the minute lands and the hour
   * silently reverts. Re-synced on every render, so the parent stays in charge.
   */
  const pending = useRef(value);
  pending.current = value;

  const set = (patch: Partial<TimeValue>) => {
    const next = clampToNow({ ...pending.current, ...patch });
    pending.current = next;
    onChange(next);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="选时间"
      left={
        <NavAction
          label="现在"
          onPress={() =>
            onChange({
              dayOffset: 0,
              hour: now.getHours(),
              minute: Math.floor(now.getMinutes() / 5) * 5,
            })
          }
        />
      }
      right={<NavAction label="完成" onPress={onClose} strong />}
      maxHeightRatio={0.6}
    >
      <View style={styles.wheels}>
        <View style={styles.selection} pointerEvents="none" />
        <Column
          items={days}
          value={value.dayOffset}
          onPick={(v) => set({ dayOffset: v })}
          flex={2.2}
          align="flex-start"
          numeric={false}
        />
        <Column items={hours} value={value.hour} onPick={(v) => set({ hour: v })} flex={1} />
        <Column items={minutes} value={value.minute} onPick={(v) => set({ minute: v })} flex={1} />
      </View>
    </Sheet>
  );
}

function Column({
  items,
  value,
  onPick,
  flex,
  align = 'center',
  numeric = true,
}: {
  items: { v: number; label: string }[];
  value: number;
  onPick: (v: number) => void;
  flex: number;
  align?: 'center' | 'flex-start';
  numeric?: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);
  const placed = useRef(false);
  const index = Math.max(
    0,
    items.findIndex((i) => i.v === value),
  );

  // Follow programmatic changes (「现在」, and the future-time clamp) without
  // fighting an in-progress drag: scrollTo during momentum is a no-op on iOS.
  // The first placement jumps rather than animates — the sheet is still opening
  // and an animation from row zero reads as the wheel spinning on its own.
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: placed.current });
    placed.current = true;
  }, [index]);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  /** Whatever row the wheel came to rest on wins, and it snaps flush to it. */
  const commit = () => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(offset.current / ITEM_H)));
    const picked = items[i];
    if (!picked) return;
    // Instant, not animated: this is a sub-row correction nobody sees, and a
    // smooth scroll issued right as momentum ends is the kind of thing iOS
    // quietly drops. Native never gets here — `snapToInterval` already landed
    // the wheel flush, so the offset is already the target.
    if (Math.abs(offset.current - i * ITEM_H) > 1) {
      ref.current?.scrollTo({ y: i * ITEM_H, animated: false });
    }
    if (picked.v !== value) onPick(picked.v);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingVertical: PAD }}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(commit, SETTLE_MS);
      }}
    >
      {items.map((item) => {
        const on = item.v === value;
        const Label = numeric ? Num : Txt;
        return (
          <View key={item.v} style={[styles.item, { alignItems: align }]}>
            <Label size={on ? 19 : 17} c={on ? color.text : color.neutral500}>
              {item.label}
            </Label>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wheels: {
    flexDirection: 'row',
    height: ITEM_H * VISIBLE,
    paddingHorizontal: 18,
    gap: 6,
  },
  selection: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: PAD,
    height: ITEM_H,
    borderRadius: radius.wheelItem,
    backgroundColor: color.neutral200,
  },
  item: { height: ITEM_H, justifyContent: 'center', paddingHorizontal: 6 },
});
