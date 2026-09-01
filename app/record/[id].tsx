/**
 * 记录详情 — reached by tapping a timeline card.
 *
 * Adds 编辑 to what the prototype had. SPEC's detail screen offered deletion
 * only, which leaves a mistyped dose unfixable; the edit button reuses the
 * record form rather than duplicating it.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

import { NavAction, NavBar } from '@/components/Screen';
import { Divider, GroupLabel, Num, PillButton, StarText, Tap, Txt } from '@/components/ui';
import { deleteRecord } from '@/db/mutations';
import { useQuery } from '@/db/live';
import { allBeans, allBrands, allRecords } from '@/db/queries';
import { beanInitial, beanName, beanSub, inkFor, swatchColor } from '@/domain/bean';
import { grindText } from '@/domain/grind';
import { monthDay, paramDisplay, ratioOf, WEEKDAYS } from '@/domain/format';
import { fieldsFor, isMethod, isSpecialBase } from '@/domain/methods';
import { photoUri } from '@/lib/photos';
import { routes } from '@/lib/routes';
import { color, METHOD_COLOR, METHOD_INK, METHOD_TINT, radius, shadowSm } from '@/theme';

export default function RecordDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: records } = useQuery(allRecords);
  const { data: beans } = useQuery(allBeans);
  const { data: brands } = useQuery(allBrands);

  const record = useMemo(() => (records ?? []).find((r) => r.id === id), [records, id]);
  const bean = useMemo(
    () => (record?.beanId ? (beans ?? []).find((b) => b.id === record.beanId) : undefined),
    [beans, record],
  );
  const brand = useMemo(
    () => (record ? (brands ?? []).find((b) => b.id === record.brandId) : undefined),
    [brands, record],
  );

  // The live query re-runs after a delete, so this also covers the moment
  // between deleting and the screen popping.
  if (!record) {
    return (
      <View style={styles.screen}>
        <NavBar title="记录" left={<NavAction label="返回" onPress={() => router.back()} chevron />} />
      </View>
    );
  }

  const method = isMethod(record.method) ? record.method : null;
  const base = record.base && isSpecialBase(record.base) ? record.base : null;
  const ratio = method ? ratioOf({ ...record, base, method }) : null;
  const uri = photoUri(record.photo);

  /** SPEC § 记录详情: the parameter rows, then the ratio as a final row. */
  const rows: { k: string; v: string }[] = [];
  if (record.gear) rows.push({ k: '冲煮器具', v: record.gear });
  if (method === '特调' && base) rows.push({ k: '基底', v: base });
  if (method) {
    for (const f of fieldsFor(method, base)) {
      const value = record[f.k];
      if (value == null) continue;
      if (f.k === 'grind') {
        rows.push({
          k: record.grinder ? `研磨 · ${record.grinder}` : '研磨',
          v: grindText(value, record.gunit),
        });
        continue;
      }
      rows.push({ k: f.label, v: paramDisplay(value, f.unit === 'grind' ? '格' : f.unit, f.dec) });
    }
  }
  if (ratio) rows.push({ k: ratio.label, v: ratio.value });

  const when = new Date(record.drankAtMs);
  const dateLine = `${monthDay(record.mon, record.day)} · ${WEEKDAYS[when.getDay()]} · ${record.time}`;

  const confirmDelete = () => {
    Alert.alert('删除这条记录？', '删掉就找不回来了。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void deleteRecord(record.id).then(() => router.back());
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <NavBar
        title="记录"
        left={<NavAction label="返回" onPress={() => router.back()} chevron />}
        right={
          <NavAction
            label="编辑"
            onPress={() => router.push(routes.editRecord(record.id))}
            strong
          />
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        {uri ? <Image source={{ uri }} style={styles.photo} resizeMode="cover" /> : null}

        <Tap
          onPress={bean ? () => router.push(routes.beanDetail(bean.id)) : undefined}
          style={styles.head}
        >
          {bean ? (
            <View style={[styles.avatar, { backgroundColor: swatchColor(bean.swatch) }]}>
              <Txt size={19} w="bold" c={inkFor(bean.swatch)}>
                {beanInitial(bean)}
              </Txt>
            </View>
          ) : null}
          <View style={styles.headText}>
            <Txt size={22} w="bold">
              {bean ? beanName(bean) : '未选豆子'}
            </Txt>
            {bean && beanSub(bean) ? (
              <Txt size={12.5} c={color.neutral700}>
                {beanSub(bean)}
              </Txt>
            ) : null}
          </View>
          {bean ? (
            <Txt size={18} c={color.neutral400}>
              ›
            </Txt>
          ) : null}
        </Tap>

        <View style={styles.tags}>
          {method ? (
            <View style={[styles.tag, { backgroundColor: METHOD_TINT[method] }]}>
              <View style={[styles.dot, { backgroundColor: METHOD_COLOR[method] }]} />
              <Txt size={13} w="semi" c={METHOD_INK[method]}>
                {method}
              </Txt>
            </View>
          ) : null}
          {record.ice ? (
            <View style={[styles.tag, styles.greenTag]}>
              <Txt size={13} w="semi" c={color.accent2_700}>
                冰
              </Txt>
            </View>
          ) : null}
          <View style={[styles.tag, styles.greenTag]}>
            <Txt size={13} c={color.accent2_700}>
              {brand?.name ?? '自制'}
            </Txt>
          </View>
          <StarText rating={record.rating} size={15} />
        </View>

        <Txt size={13.5} c={color.neutral700}>
          {dateLine}
        </Txt>

        {rows.length > 0 ? (
          <View style={styles.section}>
            <GroupLabel>参数</GroupLabel>
            <View style={styles.card}>
              {rows.map((r, i) => (
                <View key={r.k}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <View style={styles.row}>
                    <Txt size={14} c={color.neutral700}>
                      {r.k}
                    </Txt>
                    <Num size={17}>{r.v}</Num>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {record.note ? (
          <View style={styles.section}>
            <GroupLabel>备注</GroupLabel>
            <View style={styles.noteCard}>
              <Txt size={15} style={styles.noteText}>
                {record.note}
              </Txt>
            </View>
          </View>
        ) : null}

        <PillButton label="删除这条记录" tone="outline" onPress={confirmDelete} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  photo: {
    width: '100%',
    height: 240,
    borderRadius: radius.stat,
    backgroundColor: color.neutral200,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 4 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  greenTag: { backgroundColor: color.accent2_100 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  section: { gap: 2 },
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    ...shadowSm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  noteCard: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    padding: 16,
    ...shadowSm,
  },
  noteText: { lineHeight: 22 },
});
