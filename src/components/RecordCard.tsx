/**
 * One timeline card.
 *
 * SPEC § 时间线 fixes the internal order: bean name + subtitle / stars / time /
 * ⋯ → tag row → photo thumbnail → parameter string → note. Child taps that
 * navigate elsewhere (bean, brand, ⋯) must not also open the record, hence the
 * separate pressables rather than one wrapper with bubbling.
 */
import { Image } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Bean, Brand, CoffeeRecord } from '@/db/schema';
import { beanInitial, beanName, beanSub, inkFor, swatchColor } from '@/domain/bean';
import { paramText, ratioOf } from '@/domain/format';
import { isMethod, isSpecialBase } from '@/domain/methods';
import { photoUri } from '@/lib/photos';
import { color, METHOD_COLOR, METHOD_INK, METHOD_TINT, radius, shadowSm } from '@/theme';
import { Num, StarText, Tap, Txt } from './ui';

export function RecordCard({
  record,
  bean,
  brand,
  highlight,
  onPress,
  onPressBean,
  onPressBrand,
  onPressMenu,
}: {
  record: CoffeeRecord;
  bean: Bean | undefined;
  brand: Brand | undefined;
  /** SPEC: a newly saved card highlights its background once. */
  highlight?: boolean;
  onPress: () => void;
  /** Omitted while 豆子详情 / 品牌详情 do not exist — the label then renders inert. */
  onPressBean?: (beanId: string) => void;
  onPressBrand?: (brandId: string) => void;
  onPressMenu: () => void;
}) {
  const method = isMethod(record.method) ? record.method : null;
  const base = record.base && isSpecialBase(record.base) ? record.base : null;
  const ratio = method ? ratioOf({ ...record, base, method }) : null;
  const params = paramText(record);
  const uri = photoUri(record.photo);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        highlight && styles.highlight,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.head}>
        <BeanLabel
          bean={bean}
          onPress={onPressBean && record.beanId ? () => onPressBean(record.beanId!) : undefined}
        />

        <View style={styles.headRight}>
          <StarText rating={record.rating} />
          <Num size={13} c={color.neutral600}>
            {record.time}
          </Num>
          <Tap onPress={onPressMenu} style={styles.menuBtn}>
            <Txt size={18} c={color.neutral500}>
              ⋯
            </Txt>
          </Tap>
        </View>
      </View>

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
          <View style={[styles.tag, styles.iceTag]}>
            <Txt size={13} w="semi" c={color.accent2_700}>
              冰
            </Txt>
          </View>
        ) : null}

        {ratio ? (
          <Num size={13} c={color.accent700}>
            {ratio.value}
          </Num>
        ) : null}

        <View style={styles.spacer} />

        <BrandTag
          name={brand?.name ?? '自制'}
          onPress={onPressBrand ? () => onPressBrand(record.brandId) : undefined}
        />
      </View>

      {uri ? <Image source={{ uri }} style={styles.photo} resizeMode="cover" /> : null}

      {params ? (
        <Txt size={12.5} c={color.neutral700}>
          {params}
        </Txt>
      ) : null}

      {record.note ? (
        <Txt size={14} c={color.text} style={styles.note}>
          {record.note}
        </Txt>
      ) : null}
    </Pressable>
  );
}

function BeanLabel({ bean, onPress }: { bean: Bean | undefined; onPress?: () => void }) {
  const Wrap = onPress ? Tap : View;
  const sub = bean ? beanSub(bean) : '';
  return (
    <Wrap onPress={onPress} style={styles.headText}>
      <View style={styles.nameRow}>
        {/*
          The bean's own colour, carried onto the record. Menus print a coloured
          code beside each coffee for exactly this reason: it makes a list of
          similar names scannable by colour before you read a word of it.
        */}
        {bean ? (
          <View style={[styles.beanChip, { backgroundColor: swatchColor(bean.swatch) }]}>
            <Txt size={10.5} w="bold" c={inkFor(bean.swatch)}>
              {beanInitial(bean)}
            </Txt>
          </View>
        ) : null}
        <Txt size={16} w="semi" numberOfLines={1} style={styles.flex}>
          {bean ? beanName(bean) : '未选豆子'}
        </Txt>
      </View>
      {sub ? (
        <Txt size={12} c={color.neutral700} numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </Wrap>
  );
}

function BrandTag({ name, onPress }: { name: string; onPress?: () => void }) {
  const Wrap = onPress ? Tap : View;
  return (
    <Wrap onPress={onPress} style={[styles.tag, styles.brandTag]}>
      <Txt size={13} c={color.accent2_700}>
        {name}
      </Txt>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    padding: 15,
    gap: 10,
    ...shadowSm,
  },
  highlight: { backgroundColor: color.accent100 },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headText: { flex: 1, gap: 3 },
  flex: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  beanChip: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBtn: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  iceTag: { backgroundColor: color.accent2_100 },
  brandTag: { backgroundColor: color.accent2_100 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  spacer: { flex: 1 },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: radius.small,
    backgroundColor: color.neutral200,
  },
  note: { lineHeight: 20 },
});
