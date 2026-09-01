/**
 * 豆子 — Tab 2.
 *
 * Two segments (我的豆子 / 门店豆子) plus 新建. A row opens 豆子详情, which is
 * where editing, the swatch, the 5-star comparison and deletion live — the list
 * itself stays a list.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeanForm, BeanRow, emptyDraft, type BeanDraft } from '@/components/BeanSheet';
import { NavAction, ScreenTitle } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Num, PillButton, Segment, Txt } from '@/components/ui';
import { insertBean, trimOrNull } from '@/db/mutations';
import { useQuery } from '@/db/live';
import { allBeans, allRecords } from '@/db/queries';
import type { CoffeeRecord } from '@/db/schema';
import { beanStats } from '@/domain/beanStats';
import { beanUsage, sortByLastDrunk } from '@/domain/beanOrder';
import { allSettings, readSource } from '@/db/settings';
import { routes } from '@/lib/routes';
import { color, radius, shadowSm } from '@/theme';

export default function BeansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: beans } = useQuery(allBeans);
  const { data: records } = useQuery(allRecords);

  const { data: settingRows } = useQuery(allSettings);
  const defaultSource = readSource(settingRows);

  /**
   * Which half leads follows the saved preference: whichever kind of cup you
   * drink most is the one you are most often looking for. Null until the
   * preference loads, so the segment does not flip under the user.
   */
  const [tab, setTab] = useState<'shop' | 'mine' | null>(null);
  const active = tab ?? (defaultSource === 'self' ? 'mine' : 'shop');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<BeanDraft>(() => emptyDraft());

  /** Most recently drunk first; beans never opened fall to the end. */
  const list = useMemo(() => {
    const usage = beanUsage(records ?? []);
    return sortByLastDrunk(
      (beans ?? []).filter((b) => b.mine === (active === 'mine')),
      usage,
    );
  }, [beans, records, active]);

  /** Cup count and average per bean, so a row says how it has actually gone. */
  const statsById = useMemo(() => {
    const grouped = new Map<string, CoffeeRecord[]>();
    for (const r of records ?? []) {
      if (!r.beanId) continue;
      const bucket = grouped.get(r.beanId);
      if (bucket) bucket.push(r);
      else grouped.set(r.beanId, [r]);
    }
    return new Map([...grouped].map(([beanId, rows]) => [beanId, beanStats(rows)] as const));
  }, [records]);

  const startNew = () => {
    setDraft({ ...emptyDraft((beans ?? []).length), mine: active === 'mine' });
    setAdding(true);
  };

  const submit = async () => {
    await insertBean({
      name: trimOrNull(draft.name),
      origin: trimOrNull(draft.origin),
      region: trimOrNull(draft.region),
      farm: trimOrNull(draft.farm),
      variety: trimOrNull(draft.variety),
      process: trimOrNull(draft.process),
      roast: draft.roast,
      season: trimOrNull(draft.season),
      agtron: trimOrNull(draft.agtron),
      roastDate: trimOrNull(draft.roastDate),
      roaster: trimOrNull(draft.roaster),
      flavor: trimOrNull(draft.flavor),
      mine: draft.mine,
      swatch: draft.swatch,
    });
    setAdding(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 4 }]}>
        <ScreenTitle>豆子</ScreenTitle>

        <View style={styles.inner}>
          <Segment
            options={
              defaultSource === 'self'
                ? [
                    { value: 'mine', label: '我的豆子' },
                    { value: 'shop', label: '门店豆子' },
                  ]
                : [
                    { value: 'shop', label: '门店豆子' },
                    { value: 'mine', label: '我的豆子' },
                  ]
            }
            value={active}
            onChange={setTab}
          />

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Txt size={15} c={color.neutral600}>
                {active === 'mine' ? '还没有自己的豆子' : '还没有门店豆子'}
              </Txt>
            </View>
          ) : (
            <View style={styles.card}>
              {list.map((b, i) => {
                const s = statsById.get(b.id);
                return (
                  <View key={b.id}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <BeanRow bean={b} onPress={() => router.push(routes.beanDetail(b.id))} />
                    {s ? (
                      <View style={styles.meta}>
                        <Num size={12} c={color.neutral600}>
                          {s.count}
                        </Num>
                        <Txt size={11.5} c={color.neutral600}>
                          杯
                        </Txt>
                        {s.avg !== '—' ? (
                          <>
                            <Txt size={11.5} c={color.neutral400}>
                              ·
                            </Txt>
                            <Num size={12} c={color.neutral600}>
                              {s.avg}
                            </Num>
                            <Txt size={10} c={color.accent}>
                              ★
                            </Txt>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          <PillButton label="＋ 新建豆子" tone="outline" onPress={startNew} />
        </View>
      </ScrollView>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="新建豆子"
        left={<NavAction label="取消" onPress={() => setAdding(false)} />}
      >
        <BeanForm
          draft={draft}
          setDraft={setDraft}
          detailsOpenByDefault
          submitLabel="添加豆子"
          onSubmit={() => void submit()}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { paddingBottom: 40 },
  inner: { paddingHorizontal: 16, gap: 16 },
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadowSm,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 62,
    paddingBottom: 11,
    marginTop: -9,
  },
  empty: { alignItems: 'center', paddingVertical: 40 },
});
