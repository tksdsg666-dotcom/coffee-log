/**
 * The 5-star side-by-side table on 豆子详情.
 *
 * SPEC § 豆子详情: at most three cups across, differing rows highlighted. The
 * label column is fixed-width and the value columns share what is left, so
 * three columns stay readable on a phone without horizontal scrolling — with a
 * hard cap of three, they always fit.
 */
import { StyleSheet, View } from 'react-native';

import type { Comparison } from '@/domain/beanStats';
import { color, radius, shadowSm } from '@/theme';
import { Num, Txt } from './ui';

export function CompareTable({
  comparison,
  brandName,
}: {
  comparison: Comparison;
  /** Resolves a brandId for the column subheading. */
  brandName: (brandId: string) => string;
}) {
  const { columns, rows } = comparison;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.labelCol} />
        {columns.map((c) => (
          <View key={c.recordId} style={styles.valueCol}>
            <Num size={13}>{c.date}</Num>
            <Txt size={10.5} c={color.neutral700} numberOfLines={1}>
              {brandName(c.brandId)}
            </Txt>
          </View>
        ))}
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.labelCol}>
            <Txt size={12.5} c={color.neutral600} numberOfLines={2}>
              {row.label}
            </Txt>
          </View>
          {row.cells.map((cell, i) => (
            <View
              key={`${row.label}-${columns[i]?.recordId ?? i}`}
              style={[styles.valueCol, styles.cell, cell.diff && styles.cellDiff]}
            >
              <Num size={14} c={cell.diff ? color.accent700 : color.text} numberOfLines={1}>
                {cell.value}
              </Num>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.stat,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 3,
    ...shadowSm,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  labelCol: { width: 62, paddingLeft: 8 },
  valueCol: { flex: 1, alignItems: 'center', gap: 2 },
  cell: { paddingVertical: 7, paddingHorizontal: 2, borderRadius: 10 },
  cellDiff: { backgroundColor: color.accent100 },
});
