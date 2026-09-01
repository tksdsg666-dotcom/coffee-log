/**
 * 时间线 — Tab 1, the home screen.
 *
 * SPEC § 时间线: records group by calendar day, newest day first, each group
 * headed by "8 月 26 日" with a 今天 / 昨天 / weekday subtitle.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenTitle } from '@/components/Screen';
import { RecordCard } from '@/components/RecordCard';
import { Txt } from '@/components/ui';
import { deleteRecord } from '@/db/mutations';
import { useQuery } from '@/db/live';
import { allBeans, allBrands, allRecords } from '@/db/queries';
import type { CoffeeRecord } from '@/db/schema';
import { dayKey, dayLabel, monthDay } from '@/domain/format';
import { routes } from '@/lib/routes';
import { color, radius, shadowLg } from '@/theme';

export default function TimelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /** Set by the record form on save so the fresh card can flash once. */
  const { saved } = useLocalSearchParams<{ saved?: string }>();

  const { data: records } = useQuery(allRecords);
  const { data: beans } = useQuery(allBeans);
  const { data: brands } = useQuery(allBrands);

  const [now] = useState(() => new Date());

  const beanMap = useMemo(() => new Map((beans ?? []).map((b) => [b.id, b])), [beans]);
  const brandMap = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b])), [brands]);

  const sections = useMemo(() => {
    const groups = new Map<number, { title: string; sub: string; data: CoffeeRecord[] }>();
    for (const r of records ?? []) {
      const key = dayKey(r.year, r.mon, r.day);
      let g = groups.get(key);
      if (!g) {
        g = {
          title: monthDay(r.mon, r.day),
          sub: dayLabel(r.year, r.mon, r.day, now),
          data: [],
        };
        groups.set(key, g);
      }
      g.data.push(r);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, g]) => g);
  }, [records, now]);

  const confirmDelete = (record: CoffeeRecord) => {
    Alert.alert('删除这条记录？', '删掉就找不回来了。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void deleteRecord(record.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]}
        ListHeaderComponent={<ScreenTitle>时间线</ScreenTitle>}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Txt size={17} w="bold">
              {section.title}
            </Txt>
            <Txt size={13} c={color.neutral600}>
              {section.sub}
            </Txt>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RecordCard
              record={item}
              bean={item.beanId ? beanMap.get(item.beanId) : undefined}
              brand={brandMap.get(item.brandId)}
              highlight={saved === item.id}
              onPress={() => router.push(routes.recordDetail(item.id))}
              onPressBean={(beanId) => router.push(routes.beanDetail(beanId))}
              onPressDelete={() => confirmDelete(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Txt size={15} c={color.neutral600}>
              还没有记录
            </Txt>
            <Txt size={13} c={color.neutral500}>
              点右下角的 ＋ 记第一杯
            </Txt>
          </View>
        }
      />

      <Pressable
        onPress={() => router.push(routes.newRecord)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: 20 },
          pressed && { backgroundColor: color.accent600 },
        ]}
      >
        <Plus color={color.accent100} size={20} strokeWidth={2.75} />
        <Txt size={15} w="bold" c={color.accent100}>
          记一杯
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingBottom: 110 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  cardWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  empty: { alignItems: 'center', gap: 6, paddingTop: 80 },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: color.accent,
    paddingHorizontal: 22,
    height: 52,
    borderRadius: radius.pill,
    ...shadowLg,
  },
});
