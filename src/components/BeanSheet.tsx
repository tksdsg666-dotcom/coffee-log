/**
 * 选豆子 sheet.
 *
 * SPEC § 选豆子 sheet: three groups (最近用过 / 我的豆子 / 门店豆子) and an
 * inline 新建豆子 form, whose copy changes by entry point — from the record form
 * the button reads 添加并选中 and the detail fields start collapsed; from the
 * bean tab it reads 添加豆子, the details start open, and the selection is left
 * alone.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Bean, CoffeeRecord } from '@/db/schema';
import { beanUsage, sortByLastDrunk } from '@/domain/beanOrder';
import {
  beanInitial,
  beanName,
  beanSub,
  canSaveBean,
  DEFAULT_ROAST,
  inkFor,
  normalizeHex,
  PROCESSES,
  ROASTS,
  SWATCH_TOKENS,
  swatchColor,
} from '@/domain/bean';
import { color, MIN_TAP, radius } from '@/theme';
import { NavAction } from './Screen';
import { Sheet } from './Sheet';
import { Chip, Divider, GroupLabel, PillButton, Segment, Tap, Txt } from './ui';
import { Field } from './Field';

export type BeanDraft = {
  name: string;
  origin: string;
  region: string;
  farm: string;
  variety: string;
  process: string;
  roast: string;
  season: string;
  agtron: string;
  roastDate: string;
  roaster: string;
  flavor: string;
  mine: boolean;
  swatch: string;
};

export const emptyDraft = (swatchIndex = 0): BeanDraft => ({
  name: '',
  origin: '',
  region: '',
  farm: '',
  variety: '',
  process: '',
  roast: DEFAULT_ROAST,
  season: '',
  agtron: '',
  roastDate: '',
  roaster: '',
  flavor: '',
  mine: true,
  swatch: SWATCH_TOKENS[swatchIndex % SWATCH_TOKENS.length] ?? SWATCH_TOKENS[0]!,
});

export const draftOf = (b: Bean): BeanDraft => ({
  name: b.name ?? '',
  origin: b.origin ?? '',
  region: b.region ?? '',
  farm: b.farm ?? '',
  variety: b.variety ?? '',
  process: b.process ?? '',
  roast: b.roast,
  season: b.season ?? '',
  agtron: b.agtron ?? '',
  roastDate: b.roastDate ?? '',
  roaster: b.roaster ?? '',
  flavor: b.flavor ?? '',
  mine: b.mine,
  swatch: b.swatch,
});

export function BeanSheet({
  visible,
  beans,
  selectedId,
  records,
  from,
  shopFirst,
  defaultMine,
  onPick,
  onCreate,
  onClose,
}: {
  visible: boolean;
  beans: Bean[];
  selectedId: string | null;
  /** Every record, for the usage ranking. */
  records: CoffeeRecord[];
  from: 'record' | 'beanTab';
  /** Which group leads — the source of the record being logged. */
  shopFirst: boolean;
  /** Ownership a newly created bean starts on — the record form passes the
   *  source currently selected, since a bean added while logging a shop cup is
   *  almost always a shop bean. */
  defaultMine: boolean;
  onPick: (beanId: string) => void;
  onCreate: (draft: BeanDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<BeanDraft>(() => emptyDraft());

  /**
   * Two groups, and the one matching the cup being logged comes first.
   *
   * A shop cup is poured from a shop's beans; a home cup is brewed from your
   * own. Leading with the wrong half means scrolling past everything that
   * cannot be the answer. There is deliberately no 最近常喝 group above them —
   * it duplicated rows that were already visible a few lines below, and the
   * channel split is the stronger cue.
   *
   * Inside each group: most recently drunk first.
   */
  const groups = useMemo(() => {
    const usage = beanUsage(records);
    const shop = {
      title: '门店豆子',
      items: sortByLastDrunk(
        beans.filter((b) => !b.mine),
        usage,
      ),
    };
    const mine = {
      title: '我的豆子',
      items: sortByLastDrunk(
        beans.filter((b) => b.mine),
        usage,
      ),
    };
    return shopFirst ? [shop, mine] : [mine, shop];
  }, [beans, records, shopFirst]);

  const startAdding = () => {
    setDraft({ ...emptyDraft(beans.length), mine: defaultMine });
    setAdding(true);
  };

  const close = () => {
    setAdding(false);
    onClose();
  };

  const submit = async () => {
    if (!canSaveBean(draft)) return;
    await onCreate(draft);
    setAdding(false);
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={from === 'record' ? '选豆子' : '豆子'}
      left={adding ? <NavAction label="取消" onPress={() => setAdding(false)} /> : undefined}
      right={<NavAction label="关闭" onPress={close} />}
    >
      {adding ? (
        <BeanForm
          draft={draft}
          setDraft={setDraft}
          detailsOpenByDefault={from === 'beanTab'}
          submitLabel={from === 'record' ? '添加并选中' : '添加豆子'}
          onSubmit={submit}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <View key={g.title} style={styles.group}>
                <GroupLabel>{g.title}</GroupLabel>
                <View style={styles.groupCard}>
                  {g.items.map((b, i) => (
                    <View key={`${g.title}-${b.id}`}>
                      {i > 0 ? <Divider inset={62} /> : null}
                      <BeanRow
                        bean={b}
                        selected={b.id === selectedId}
                        onPress={() => {
                          onPick(b.id);
                          close();
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ),
          )}

          <PillButton label="＋ 新建豆子" tone="outline" onPress={startAdding} style={styles.addBtn} />
        </ScrollView>
      )}
    </Sheet>
  );
}

export function BeanRow({
  bean,
  selected,
  onPress,
}: {
  bean: Bean;
  selected?: boolean;
  onPress: () => void;
}) {
  const sub = beanSub(bean);
  return (
    <Tap
      onPress={onPress}
      style={[styles.row, selected ? { backgroundColor: color.accent100 } : null]}
    >
      <View style={[styles.avatar, { backgroundColor: swatchColor(bean.swatch) }]}>
        <Txt size={16} w="bold" c={inkFor(bean.swatch)}>
          {beanInitial(bean)}
        </Txt>
      </View>
      <View style={styles.rowText}>
        <Txt size={15} w="semi" numberOfLines={1}>
          {beanName(bean)}
        </Txt>
        {sub ? (
          <Txt size={12} c={color.neutral600} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {selected ? (
        <Txt size={16} w="bold" c={color.accent}>
          ✓
        </Txt>
      ) : null}
    </Tap>
  );
}

/** The inline create/edit form, shared by the sheet and the bean tab. */
export function BeanForm({
  draft,
  setDraft,
  detailsOpenByDefault,
  submitLabel,
  onSubmit,
}: {
  draft: BeanDraft;
  setDraft: (d: BeanDraft) => void;
  detailsOpenByDefault: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const [more, setMore] = useState(detailsOpenByDefault);
  const [hex, setHex] = useState('');
  const set = <K extends keyof BeanDraft>(k: K, v: BeanDraft[K]) => setDraft({ ...draft, [k]: v });

  const customProcess = draft.process !== '' && !PROCESSES.includes(draft.process as never);

  return (
    <ScrollView
      contentContainerStyle={styles.formBody}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Segment
        options={[
          { value: 'shop', label: '门店豆子' },
          { value: 'mine', label: '我的豆子' },
        ]}
        value={draft.mine ? 'mine' : 'shop'}
        onChange={(v) => set('mine', v === 'mine')}
      />

      <Field label="名称" value={draft.name} onChange={(v) => set('name', v)} placeholder="留空则用产地拼" />
      <Field label="产地" value={draft.origin} onChange={(v) => set('origin', v)} placeholder="埃塞俄比亚" />
      <Field label="庄园" value={draft.farm} onChange={(v) => set('farm', v)} placeholder="罕贝拉" />

      <Txt size={11.5} c={color.neutral500}>
        名称 / 产地 / 庄园 至少填一个
      </Txt>

      <Tap onPress={() => setMore(!more)} style={styles.moreToggle}>
        <Txt size={15} w="semi" c={color.accent700}>
          {more ? '收起补充详情' : '补充详情'}
        </Txt>
      </Tap>

      {more ? (
        <View style={styles.moreBody}>
          <Field label="产区" value={draft.region} onChange={(v) => set('region', v)} />
          <Field label="品种" value={draft.variety} onChange={(v) => set('variety', v)} />

          <View style={styles.fieldBlock}>
            <Txt size={13} c={color.neutral700}>
              处理法
            </Txt>
            <View style={styles.chipRow}>
              {PROCESSES.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  selected={draft.process === p}
                  onPress={() => set('process', draft.process === p ? '' : p)}
                />
              ))}
            </View>
            <Field
              label=""
              value={customProcess ? draft.process : ''}
              onChange={(v) => set('process', v)}
              placeholder="或自己填一个"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Txt size={13} c={color.neutral700}>
              烘焙度
            </Txt>
            <View style={styles.chipRow}>
              {ROASTS.map((r) => (
                <Chip key={r} label={r} selected={draft.roast === r} onPress={() => set('roast', r)} />
              ))}
            </View>
          </View>

          <Field label="产季" value={draft.season} onChange={(v) => set('season', v)} placeholder="2025-2026" />
          <Field
            label="烘焙色值"
            value={draft.agtron}
            onChange={(v) => set('agtron', v)}
            placeholder="Agtron 82"
            keyboardType="number-pad"
          />
          <Field label="烘焙日期" value={draft.roastDate} onChange={(v) => set('roastDate', v)} placeholder="8/12" />
          <Field label="烘焙商" value={draft.roaster} onChange={(v) => set('roaster', v)} />
          <Field
            label="风味"
            value={draft.flavor}
            onChange={(v) => set('flavor', v)}
            placeholder="茉莉、白桃、柠檬茶"
            multiline
          />

          <View style={styles.fieldBlock}>
            <Txt size={13} c={color.neutral700}>
              图标颜色
            </Txt>
            <View style={styles.swatchRow}>
              {SWATCH_TOKENS.map((s) => (
                <Tap
                  key={s}
                  onPress={() => set('swatch', s)}
                  style={[
                    styles.swatch,
                    { backgroundColor: swatchColor(s) },
                    draft.swatch === s && styles.swatchOn,
                  ]}
                />
              ))}
            </View>
            <Field
              label=""
              value={hex}
              onChange={(v) => {
                setHex(v);
                const norm = normalizeHex(v);
                if (norm) set('swatch', norm);
              }}
              placeholder="#c67139 / c73 / rgb(198,113,57)"
              autoCapitalize="none"
            />
          </View>
        </View>
      ) : null}

      <PillButton
        label={submitLabel}
        onPress={onSubmit}
        disabled={!canSaveBean(draft)}
        style={styles.submit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listBody: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  formBody: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  group: { gap: 2 },
  groupCard: { backgroundColor: color.neutral100, borderRadius: radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 62,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  addBtn: { marginTop: 4 },
  moreToggle: { minHeight: MIN_TAP, justifyContent: 'center' },
  moreBody: { gap: 12 },
  fieldBlock: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchRow: { flexDirection: 'row', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: color.text },
  submit: { marginTop: 8 },
});
