/**
 * 豆子详情.
 *
 * SPEC § 豆子详情 fixes the order: 头像 + 名称 + 烘焙商 → 三宫格 → 图标颜色 →
 * 属性表 → 5 星并列对比 → 全部记录 → 删除.
 *
 * The swatch picker writes through on every tap rather than waiting for a save:
 * it is the one control on this screen with no form around it, and SPEC places
 * it inline with the read-only content.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BeanForm, draftOf, type BeanDraft } from '@/components/BeanSheet';
import { CompareTable } from '@/components/CompareTable';
import { Field } from '@/components/Field';
import { NavAction, NavBar } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Divider, GroupLabel, Num, PillButton, StarText, Tap, Txt } from '@/components/ui';
import { deleteBeanCascade, trimOrNull, updateBean } from '@/db/mutations';
import { useQuery } from '@/db/live';
import { allBeans, allBrands, allRecords } from '@/db/queries';
import { beanStats, buildComparison } from '@/domain/beanStats';
import {
  beanAttrs,
  beanInitial,
  beanName,
  inkFor,
  normalizeHex,
  SWATCH_TOKENS,
  swatchColor,
} from '@/domain/bean';
import { monthDay, paramText } from '@/domain/format';
import { isMethod } from '@/domain/methods';
import { routes } from '@/lib/routes';
import { color, METHOD_COLOR, radius, shadowSm } from '@/theme';

export default function BeanDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: beans } = useQuery(allBeans);
  const { data: records } = useQuery(allRecords);
  const { data: brands } = useQuery(allBrands);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BeanDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [hex, setHex] = useState('');

  const bean = useMemo(() => (beans ?? []).find((b) => b.id === id), [beans, id]);
  const mine = useMemo(
    () => (records ?? []).filter((r) => r.beanId === id),
    [records, id],
  );
  const brandNames = useMemo(
    () => new Map((brands ?? []).map((b) => [b.id, b.name])),
    [brands],
  );

  const stats = useMemo(() => beanStats(mine), [mine]);
  const comparison = useMemo(() => buildComparison(mine), [mine]);

  // Deleting the bean pops this screen, but the live query fires first.
  if (!bean) {
    return (
      <View style={styles.screen}>
        <NavBar title="豆子" left={<NavAction label="返回" onPress={() => router.back()} chevron />} />
      </View>
    );
  }

  const attrs = beanAttrs(bean);
  const hexPreview = normalizeHex(hex) ?? swatchColor(bean.swatch);

  const pickSwatch = (swatch: string) => {
    void updateBean(bean.id, { ...bean, swatch });
  };

  const onHexChange = (raw: string) => {
    setHex(raw);
    const norm = normalizeHex(raw);
    if (norm) pickSwatch(norm);
  };

  const startEdit = () => {
    setDraft(draftOf(bean));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!draft) return;
    await updateBean(bean.id, {
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
    setEditing(false);
  };

  return (
    <View style={styles.screen}>
      <NavBar
        title="豆子"
        left={<NavAction label="返回" onPress={() => router.back()} chevron />}
        right={<NavAction label="编辑" onPress={startEdit} strong />}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {/* 头像 + 名称 + 烘焙商 */}
        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: swatchColor(bean.swatch) }]}>
            <Num size={22} c={inkFor(bean.swatch)}>
              {beanInitial(bean)}
            </Num>
          </View>
          <View style={styles.headText}>
            <Txt size={22} w="bold">
              {beanName(bean)}
            </Txt>
            {bean.roaster ? (
              <Txt size={13} c={color.neutral600}>
                {bean.roaster}
              </Txt>
            ) : null}
          </View>
        </View>

        {/* 三宫格 */}
        <View style={styles.statRow}>
          <Stat value={String(stats.count)} label="杯" />
          <Stat value={stats.avg} label="平均评分" />
          <Stat value={stats.bestRatio} label="高分常用比例" />
        </View>

        {/* 图标颜色 */}
        <View style={styles.swatchBlock}>
          <Txt size={13} c={color.neutral700}>
            图标颜色
          </Txt>
          <View style={styles.swatchRow}>
            {SWATCH_TOKENS.map((s) => (
              <Tap
                key={s}
                onPress={() => pickSwatch(s)}
                style={[
                  styles.swatch,
                  { backgroundColor: swatchColor(s) },
                  bean.swatch === s && styles.swatchOn,
                ]}
              />
            ))}
          </View>
          <View style={styles.hexRow}>
            <View style={[styles.hexPreview, { backgroundColor: hexPreview }]} />
            <View style={styles.flex}>
              <Field
                label=""
                value={hex}
                onChange={onHexChange}
                placeholder="自定义：#c67139 或 rgb(198,113,57)"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>

        {/* 属性表 */}
        {attrs.length > 0 ? (
          <View style={styles.card}>
            {attrs.map((a, i) => (
              <View key={a.k}>
                {i > 0 ? <Divider inset={16} /> : null}
                <View style={styles.attrRow}>
                  <Txt size={14} c={color.neutral700}>
                    {a.k}
                  </Txt>
                  <Txt size={15} w="semi" style={styles.attrValue}>
                    {a.v}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* 5 星并列对比 */}
        {comparison ? (
          <View style={styles.section}>
            <View style={styles.compareHead}>
              <Txt size={16} w="bold">
                5 星的 {comparison.columns.length} 杯（{comparison.method}）
              </Txt>
              <Txt size={12.5} c={color.neutral600}>
                底色标出的是这几杯之间不一样的参数
              </Txt>
            </View>
            <CompareTable
              comparison={comparison}
              brandName={(brandId) => brandNames.get(brandId) ?? '自制'}
            />
          </View>
        ) : null}

        {/* 全部记录 */}
        {mine.length > 0 ? (
          <View style={styles.section}>
            <GroupLabel>全部记录</GroupLabel>
            <View style={styles.recordList}>
              {mine.map((r) => {
                const method = isMethod(r.method) ? r.method : null;
                const params = paramText(r);
                return (
                  <Tap
                    key={r.id}
                    onPress={() => router.push(routes.recordDetail(r.id))}
                    style={styles.recordRow}
                  >
                    <View
                      style={[
                        styles.methodDot,
                        { backgroundColor: method ? METHOD_COLOR[method] : color.neutral400 },
                      ]}
                    />
                    <View style={styles.recordText}>
                      <Txt size={14} w="semi">
                        {monthDay(r.mon, r.day)} · {r.method}
                      </Txt>
                      {params ? (
                        <Txt size={12} c={color.neutral700} numberOfLines={1}>
                          {params}
                        </Txt>
                      ) : null}
                    </View>
                    <StarText rating={r.rating} size={12} />
                  </Tap>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 删除 */}
        {confirming ? (
          <View style={styles.confirmCard}>
            <Txt size={14.5} w="semi">
              {mine.length > 0
                ? `确认删除？${mine.length} 条记录会一起删掉`
                : '确认删除？'}
            </Txt>
            <View style={styles.confirmRow}>
              <PillButton
                label="取消"
                tone="quiet"
                onPress={() => setConfirming(false)}
                style={styles.flex}
              />
              <PillButton
                label="删除"
                onPress={() => {
                  void deleteBeanCascade(bean.id).then(() => router.back());
                }}
                style={styles.flex}
              />
            </View>
          </View>
        ) : (
          <PillButton
            label={mine.length > 0 ? `删除豆子和 ${mine.length} 条记录` : '删除这支豆子'}
            tone="outline"
            onPress={() => setConfirming(true)}
          />
        )}
      </ScrollView>

      <Sheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="编辑豆子"
        left={<NavAction label="取消" onPress={() => setEditing(false)} />}
      >
        {draft ? (
          <BeanForm
            draft={draft}
            setDraft={setDraft}
            detailsOpenByDefault
            submitLabel="保存修改"
            onSubmit={() => void saveEdit()}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Num size={22} c={color.accent700} numberOfLines={1} adjustsFontSizeToFit>
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
  body: { padding: 16, paddingBottom: 48, gap: 24 },
  flex: { flex: 1 },
  section: { gap: 10 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 5 },

  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: color.neutral100,
    borderRadius: radius.small,
    padding: 14,
    gap: 3,
    ...shadowSm,
  },

  swatchBlock: { gap: 9, paddingHorizontal: 4 },
  swatchRow: { flexDirection: 'row', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: color.text },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  hexPreview: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.hairline,
  },

  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.stat,
    ...shadowSm,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 46,
  },
  attrValue: { flex: 1, textAlign: 'right' },

  compareHead: { gap: 3, paddingHorizontal: 6 },

  recordList: { gap: 8 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: color.neutral100,
    borderRadius: radius.small,
    paddingHorizontal: 15,
    paddingVertical: 13,
    ...shadowSm,
  },
  methodDot: { width: 8, height: 8, borderRadius: 999 },
  recordText: { flex: 1, gap: 3 },

  confirmCard: {
    backgroundColor: color.accent100,
    borderWidth: 1,
    borderColor: color.accent,
    borderRadius: radius.stat,
    padding: 16,
    gap: 12,
  },
  confirmRow: { flexDirection: 'row', gap: 9 },
});
