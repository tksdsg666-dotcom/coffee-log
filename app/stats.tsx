/**
 * 统计 — a month calendar plus the totals beside it.
 *
 * SPEC put dot matrices here and no charts. The calendar keeps that: a lit
 * circle per day, deeper the more cups, so a run of mornings reads as a shape
 * rather than as a number. The method breakdown stays a literal dot matrix,
 * one dot per cup, exactly as SPEC § 统计 describes.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { NavAction, NavBar } from '@/components/Screen';
import { GroupLabel, Num, Tap, Txt } from '@/components/ui';
import { useQuery } from '@/db/live';
import { allRecords } from '@/db/queries';
import {
  cupsByDay,
  intensity,
  monthGrid,
  monthSummary,
  shiftMonth,
  WEEK_LABELS,
} from '@/domain/calendar';
import { isMethod } from '@/domain/methods';
import { color, METHOD_COLOR, radius, shadowSm } from '@/theme';

/**
 * Accent ramp for 1 / 2 / 3+ cups in a day. Three steps of brown rather than
 * starting at accent300, which reads pink beside the rest of the screen.
 */
const LEVEL_FILL = [color.accent, color.accent700, color.accent900] as const;

export default function StatsScreen() {
  const router = useRouter();
  const { data: records } = useQuery(allRecords);

  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    mon: today.getMonth() + 1,
  }));

  const rows = records ?? [];
  const grid = useMemo(() => monthGrid(cursor.year, cursor.mon), [cursor]);
  const perDay = useMemo(() => cupsByDay(rows, cursor.year, cursor.mon), [rows, cursor]);
  const summary = useMemo(() => monthSummary(rows, cursor.year, cursor.mon), [rows, cursor]);

  const isThisMonth =
    cursor.year === today.getFullYear() && cursor.mon === today.getMonth() + 1;

  return (
    <View style={styles.screen}>
      <NavBar
        title="统计"
        left={<NavAction label="返回" onPress={() => router.back()} chevron />}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Month pager */}
        <View style={styles.monthBar}>
          <Tap onPress={() => setCursor((c) => shiftMonth(c.year, c.mon, -1))} style={styles.arrow}>
            <Txt size={22} c={color.accent700}>
              ‹
            </Txt>
          </Tap>
          <View style={styles.monthLabel}>
            <Num size={26}>
              {cursor.year} 年 {cursor.mon} 月
            </Num>
          </View>
          <Tap
            onPress={() => setCursor((c) => shiftMonth(c.year, c.mon, 1))}
            // Nothing has been drunk in the future.
            disabled={isThisMonth}
            style={[styles.arrow, isThisMonth && styles.arrowOff]}
          >
            <Txt size={22} c={isThisMonth ? color.neutral400 : color.accent700}>
              ›
            </Txt>
          </Tap>
        </View>

        {/* Calendar */}
        <View style={styles.card}>
          <View style={styles.weekHead}>
            {WEEK_LABELS.map((w) => (
              <View key={w} style={styles.cell}>
                <Txt size={11.5} c={color.neutral600}>
                  {w}
                </Txt>
              </View>
            ))}
          </View>

          {grid.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((day, di) => {
                if (day == null) return <View key={`pad-${di}`} style={styles.cell} />;
                const cups = perDay.get(day) ?? 0;
                const level = intensity(cups);
                const isToday =
                  isThisMonth && day === today.getDate();
                return (
                  <View key={day} style={styles.cell}>
                    <View
                      style={[
                        styles.dot,
                        level > 0
                          ? { backgroundColor: LEVEL_FILL[level - 1] }
                          : styles.dotEmpty,
                        isToday && styles.dotToday,
                      ]}
                    >
                      <Num size={12.5} c={level > 0 ? color.accent100 : color.neutral500}>
                        {day}
                      </Num>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.legend}>
            <Txt size={11} c={color.neutral500}>
              少
            </Txt>
            <View style={[styles.legendDot, styles.dotEmpty]} />
            {LEVEL_FILL.map((c) => (
              <View key={c} style={[styles.legendDot, { backgroundColor: c }]} />
            ))}
            <Txt size={11} c={color.neutral500}>
              多
            </Txt>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.statRow}>
          <Stat value={String(summary.cups)} label="杯" />
          <Stat value={String(summary.activeDays)} label="天喝了" />
          <Stat value={String(summary.bestStreak)} label="最长连续" />
        </View>

        {/* Per-method dot matrix */}
        <View style={styles.section}>
          <GroupLabel>各做法</GroupLabel>
          {summary.byMethod.length === 0 ? (
            <View style={styles.emptyCard}>
              <Txt size={14} c={color.neutral600}>
                这个月还没有记录
              </Txt>
            </View>
          ) : (
            <View style={styles.card}>
              {summary.byMethod.map((m) => {
                const tint = isMethod(m.method) ? METHOD_COLOR[m.method] : color.neutral700;
                return (
                  <View key={m.method} style={styles.methodBlock}>
                    <View style={styles.methodHead}>
                      <View style={[styles.methodDot, { backgroundColor: tint }]} />
                      <Txt size={14} w="semi" style={styles.methodName}>
                        {m.method}
                      </Txt>
                      <Num size={15} c={color.neutral600}>
                        {m.pct}%
                      </Num>
                      <Num size={17}>{m.count}</Num>
                    </View>
                    {/* SPEC § 统计: one dot per cup, wrapping. */}
                    <View style={styles.matrix}>
                      {Array.from({ length: m.count }, (_, i) => (
                        <View key={i} style={[styles.cup, { backgroundColor: tint }]} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Num size={22} c={color.accent700}>
        {value}
      </Num>
      <Txt size={12} c={color.neutral700}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, paddingBottom: 48, gap: 18 },

  monthBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthLabel: { flex: 1, alignItems: 'center' },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.neutral100,
  },
  arrowOff: { opacity: 0.4 },

  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.stat,
    padding: 12,
    ...shadowSm,
  },
  weekHead: { flexDirection: 'row', paddingBottom: 6 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotEmpty: { backgroundColor: color.neutral200 },
  dotToday: { borderWidth: 2, borderColor: color.accent2 },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingTop: 10,
    paddingRight: 4,
  },
  legendDot: { width: 11, height: 11, borderRadius: 999 },

  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: color.neutral100,
    borderRadius: radius.small,
    padding: 14,
    gap: 3,
    ...shadowSm,
  },

  section: { gap: 10 },
  emptyCard: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    padding: 20,
    alignItems: 'center',
    ...shadowSm,
  },
  methodBlock: { paddingVertical: 10, paddingHorizontal: 4, gap: 8 },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodDot: { width: 8, height: 8, borderRadius: 999 },
  methodName: { flex: 1 },
  matrix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cup: { width: 13, height: 13, borderRadius: 999 },
});
