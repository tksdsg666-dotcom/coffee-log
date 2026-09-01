/**
 * 记一杯 — new when opened bare, edit when given `?id=`.
 *
 * SPEC § 记一杯: the field order below is a design conclusion and must not be
 * rearranged. The other rule that shapes this file is § 来源切换的副作用 —
 * picking 门店 blanks the parameters of all five methods and keeps them blank
 * across method switches, while picking 自制 restores the current method's
 * defaults. That is why `vals` holds every method at once rather than only the
 * selected one: switching back and forth must not lose what was typed.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeanSheet, type BeanDraft } from '@/components/BeanSheet';
import { Field } from '@/components/Field';
import { GrindCard } from '@/components/GrindCard';
import { ParamRow } from '@/components/ParamRow';
import { PhotoField } from '@/components/PhotoField';
import { NavAction, NavBar } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { TimeSheet, resolveTime, toTimeValue, type TimeValue } from '@/components/TimeSheet';
import { Chip, Divider, GroupLabel, Num, PillButton, Segment, Tap, Txt } from '@/components/ui';
import { db } from '@/db/client';
import {
  insertBean,
  insertBrand,
  insertRecord,
  trimOrNull,
  updateRecord,
} from '@/db/mutations';
import { useQuery } from '@/db/live';
import { allBeans, allBrands, allDevices, allRecords } from '@/db/queries';
import { allSettings, readSource, readTemp } from '@/db/settings';
import { records as recordsTable, type CoffeeRecord, type Device } from '@/db/schema';
import { swatchColor, beanName as displayBeanName, beanSub, inkFor } from '@/domain/bean';
import { clampGrind, grindSpecOf } from '@/domain/grind';
import { monthDay, paramDisplay, ratioLabelOf, ratioOf, pad2, WEEKDAYS } from '@/domain/format';
import {
  blankParams,
  DEFAULT_BASE,
  defaultParams,
  defaultsFor,
  fieldsFor,
  isMethod,
  isSpecialBase,
  METHODS,
  SPECIAL_BASES,
  type Method,
  type ParamField,
  type ParamKey,
  type SpecialBase,
  usesCustomName,
  usesGear,
  usesGrindCard,
} from '@/domain/methods';
import { color, METHOD_COLOR, MIN_TAP, radius, shadowSm } from '@/theme';
import { eq } from 'drizzle-orm';

/**
 * Parameters for every method at once, so switching back and forth never loses
 * what was typed. 特调 is keyed by base as well — its fields change with the
 * base, and a half-filled espresso build should survive a look at the cold brew
 * variant.
 */
type Vals = Record<string, Record<ParamKey, number | null>>;

/** Key into `vals`: the method, plus the base when the method has one. */
const valsKey = (method: Method, base: SpecialBase | null): string =>
  method === '特调' ? `特调:${base ?? DEFAULT_BASE}` : method;

type Slot = { key: string; method: Method; base: SpecialBase | null };

const eachSlot = (): Slot[] =>
  METHODS.flatMap((m): Slot[] =>
    m === '特调'
      ? SPECIAL_BASES.map((b) => ({ key: valsKey(m, b), method: m, base: b }))
      : [{ key: m, method: m, base: null }],
  );

const allDefaults = (): Vals =>
  Object.fromEntries(eachSlot().map((s) => [s.key, defaultParams(s.method, s.base)]));

const allBlank = (): Vals =>
  Object.fromEntries(eachSlot().map((s) => [s.key, blankParams(s.method, s.base)]));

export default function RecordForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(editId);

  const { data: beans } = useQuery(allBeans);
  const { data: brands } = useQuery(allBrands);
  const { data: devices } = useQuery(allDevices);
  const { data: records } = useQuery(allRecords);
  const { data: settingRows } = useQuery(allSettings);
  const defaultSource = readSource(settingRows);
  const defaultTemp = readTemp(settingRows);

  /** SPEC § 时间: the clock is read once when the form opens, not per render. */
  const [now] = useState(() => new Date());

  /**
   * The source segment, kept separate from which brand is chosen.
   *
   * They used to be one value, and the segment therefore had to wait for the
   * brands query — whose `data` starts as `[]`, not undefined, so the first
   * render concluded "no shop brands exist" and fell back to 自制 before the
   * query had run. Null here means "not touched", so the saved preference wins.
   */
  const [source, setSource] = useState<'shop' | 'self' | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>('滴滤');
  /** Only 特调 uses this; every other method keeps it null. */
  const [base, setBase] = useState<SpecialBase | null>(null);
  const [ice, setIce] = useState<boolean | null>(null);
  const [beanId, setBeanId] = useState<string | null>(null);
  const [gear, setGear] = useState<string | null>(null);
  const [grinder, setGrinder] = useState<string | null>(null);
  const [vals, setVals] = useState<Vals>(allDefaults);
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  /** Free-text label for a 其他 cup — 虹吸, 摩卡壶, whatever it actually was. */
  const [methodName, setMethodName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [time, setTime] = useState<TimeValue>(() => ({
    dayOffset: 0,
    hour: now.getHours(),
    minute: Math.floor(now.getMinutes() / 5) * 5,
  }));

  const [beanSheet, setBeanSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [brandSheet, setBrandSheet] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [loaded, setLoaded] = useState(!isEdit);
  const [saving, setSaving] = useState(false);

  const effectiveSource = source ?? defaultSource;
  const isIced = ice ?? defaultTemp === 'ice';
  const isSelf = effectiveSource === 'self';
  const slotKey = valsKey(method, base);

  const brewDevices = useMemo(() => (devices ?? []).filter((d) => d.isBrew), [devices]);
  const grinderDevices = useMemo(() => (devices ?? []).filter((d) => d.isGrinder), [devices]);
  const shopBrands = useMemo(() => (brands ?? []).filter((b) => !b.isSelf), [brands]);

  const grinderDevice: Device | null = useMemo(
    () => grinderDevices.find((d) => d.name === grinder) ?? null,
    [grinderDevices, grinder],
  );
  const spec = useMemo(() => grindSpecOf(grinderDevice), [grinderDevice]);

  // ── load the record being edited ───────────────────────────────────────────
  useEffect(() => {
    if (!editId || loaded) return;
    let cancelled = false;
    void (async () => {
      const [row] = await db.select().from(recordsTable).where(eq(recordsTable.id, editId)).limit(1);
      if (cancelled || !row) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const m: Method = isMethod(row.method) ? row.method : '滴滤';
      const b = row.base && isSpecialBase(row.base) ? row.base : m === '特调' ? DEFAULT_BASE : null;
      const seeded = row.brandId === 'self' ? allDefaults() : allBlank();
      seeded[valsKey(m, b)] = {
        ...blankParams(m, b),
        ...Object.fromEntries(
          fieldsFor(m, b).map((f) => [f.k, (row[f.k] as number | null) ?? null]),
        ),
      } as Record<ParamKey, number | null>;

      setSource(row.brandId === 'self' ? 'self' : 'shop');
      setBrandId(row.brandId === 'self' ? null : row.brandId);
      setMethod(m);
      setBase(b);
      setIce(Boolean(row.ice));
      setBeanId(row.beanId);
      setGear(row.gear);
      setGrinder(row.grinder);
      setVals(seeded);
      setRating(row.rating);
      setNote(row.note);
      setMethodName(row.methodName ?? '');
      setPhoto(row.photo);
      setTime(toTimeValue(new Date(row.drankAtMs), now));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, loaded, now]);

  /**
   * A shop record starts with every parameter blank (SPEC § 来源切换的副作用).
   * Runs once the preference has actually loaded, and only on a new record the
   * user has not touched yet.
   */
  const [seeded, setSeeded] = useState(isEdit);
  useEffect(() => {
    if (seeded || settingRows == null) return;
    if (defaultSource === 'shop') setVals(allBlank());
    setSeeded(true);
  }, [seeded, settingRows, defaultSource]);

  // Pick up the first shop brand once brands load, unless one is already chosen.
  useEffect(() => {
    if (isEdit || isSelf || brandId != null) return;
    const first = shopBrands[0];
    if (first) setBrandId(first.id);
  }, [isEdit, isSelf, brandId, shopBrands]);

  // Default the gear/grinder pickers to the first device once devices load.
  useEffect(() => {
    if (isEdit) return;
    if (gear == null && brewDevices.length > 0) setGear(brewDevices[0]!.name);
    if (grinder == null && grinderDevices.length > 0) setGrinder(grinderDevices[0]!.name);
  }, [isEdit, gear, grinder, brewDevices, grinderDevices]);

  // ── source / method switching ──────────────────────────────────────────────

  const pickSource = (next: 'self' | 'shop') => {
    setSource(next);
    if (next === 'self') {
      // SPEC: 选自制 restores the *current* method's defaults.
      setVals((v) => ({ ...v, [slotKey]: defaultParams(method, base) }));
      return;
    }
    // SPEC: 选门店 clears every method's parameters, and they stay clear when
    // the method changes afterwards.
    setVals(allBlank());
    const first = shopBrands[0];
    if (first) setBrandId(first.id);
    else setBrandSheet(true);
  };

  const pickMethod = (m: Method) => {
    setMethod(m);
    // 特调 always has a base; every other method drops it.
    const nextBase = m === '特调' ? (base ?? DEFAULT_BASE) : null;
    setBase(nextBase);
    if (!isSelf) {
      setVals((v) => ({ ...v, [valsKey(m, nextBase)]: blankParams(m, nextBase) }));
    }
  };

  const pickBase = (b: SpecialBase) => {
    setBase(b);
    if (!isSelf) {
      setVals((v) => ({ ...v, [valsKey('特调', b)]: blankParams('特调', b) }));
    }
  };

  // ── parameter editing ──────────────────────────────────────────────────────

  const showGrindCard = usesGrindCard(method, isSelf ? 'self' : 'shop') && spec != null;

  /** Fields shown as rows — grind is pulled out into its own card when shown. */
  const rowFields = useMemo(
    () => fieldsFor(method, base).filter((f) => !(f.k === 'grind' && showGrindCard)),
    [method, base, showGrindCard],
  );

  const setParam = (k: ParamKey, value: number | null) =>
    setVals((v) => ({
      ...v,
      [slotKey]: { ...(v[slotKey] ?? blankParams(method, base)), [k]: value },
    }));

  /**
   * Per-field arithmetic bounds. ParamRow owns the stepping and scrubbing; this
   * only says what scale the field is on, and grind takes its scale from the
   * selected grinder rather than from the method.
   */
  const boundsOf = (f: ParamField) => {
    const isGrind = f.k === 'grind';
    return {
      step: isGrind && spec ? spec.step : f.step,
      min: isGrind && spec ? spec.min : f.min,
      max: isGrind ? (spec ? spec.max : null) : (f.max ?? null),
      // SPEC § 参数留空: ± on a cleared field restores the default rather than
      // stepping up from zero.
      fallback: isGrind && spec ? spec.def : (defaultsFor(method, base)[f.k] ?? null),
    };
  };

  const clearAll = () => setVals((v) => ({ ...v, [slotKey]: blankParams(method, base) }));

  /** Snap a stale grind value into the newly selected grinder's scale. */
  const pickGrinder = (name: string) => {
    setGrinder(name);
    const next = grinderDevices.find((d) => d.name === name);
    const nextSpec = grindSpecOf(next);
    setVals((v) => {
      const slot = v[slotKey];
      if (!slot || slot.grind == null || !nextSpec) return v;
      // SPEC § 研磨刻度: 换磨时研磨值重置为该磨默认值.
      return { ...v, [slotKey]: { ...slot, grind: nextSpec.def } };
    });
  };

  // ── derived display ────────────────────────────────────────────────────────

  const params = vals[slotKey] ?? blankParams(method, base);
  const ratio = ratioOf({ method, base, ...params });
  const ratioLabel = ratioLabelOf(method, base);

  const beanMap = useMemo(() => new Map((beans ?? []).map((b) => [b.id, b])), [beans]);
  const selectedBean = beanId ? beanMap.get(beanId) : undefined;

  /** SPEC § 记一杯: 沿用最近 — three presets, self-made records only. */
  const presets = useMemo(() => {
    const out: CoffeeRecord[] = [];
    for (const r of records ?? []) {
      if (r.brandId !== 'self' || !r.beanId) continue;
      if (out.some((x) => x.beanId === r.beanId && x.method === r.method)) continue;
      out.push(r);
      if (out.length >= 3) break;
    }
    return out;
  }, [records]);

  const applyPreset = (r: CoffeeRecord) => {
    const m: Method = isMethod(r.method) ? r.method : method;
    const b = r.base && isSpecialBase(r.base) ? r.base : m === '特调' ? DEFAULT_BASE : null;
    setMethod(m);
    setBase(b);
    setSource('self');
    setBeanId(r.beanId);
    setIce(Boolean(r.ice));
    if (r.gear) setGear(r.gear);
    if (r.grinder) setGrinder(r.grinder);
    setVals((v) => ({
      ...v,
      [valsKey(m, b)]: Object.fromEntries(
        fieldsFor(m, b).map((f) => [f.k, (r[f.k] as number | null) ?? null]),
      ) as Record<ParamKey, number | null>,
    }));
  };

  /** SPEC § 研磨刻度: the four most recent distinct settings on this grinder. */
  const grindRecents = useMemo(() => {
    if (!spec || !grinder) return [];
    const out: number[] = [];
    for (const r of records ?? []) {
      if (r.grinder !== grinder || r.grind == null) continue;
      const v = clampGrind(r.grind, spec);
      if (v != null && !out.includes(v)) out.push(v);
      if (out.length >= 4) break;
    }
    return out;
  }, [records, grinder, spec]);

  const when = resolveTime(time, now);
  const timeSummary =
    time.dayOffset === 0
      ? '今天'
      : time.dayOffset === 1
        ? '昨天'
        : `${monthDay(when.getMonth() + 1, when.getDate())} · ${WEEKDAYS[when.getDay()]}`;
  const clock = `${pad2(time.hour)}:${pad2(time.minute)}`;

  // ── save ───────────────────────────────────────────────────────────────────

  const save = async () => {
    if (saving) return;

    // A shop cup without a shop is not a shop cup — refuse rather than quietly
    // writing it as 自制.
    const targetBrand = isSelf ? 'self' : brandId;
    if (targetBrand == null) {
      Alert.alert('先选一个品牌', '门店记录得说明是在哪儿喝的。');
      return;
    }

    setSaving(true);
    try {
      const withGear = usesGear(method, isSelf ? 'self' : 'shop');
      // Start every parameter column at null so an edit that changes the method
      // does not leave the previous method's values stranded on the row.
      const blank: Record<ParamKey, number | null> = {
        dose: null,
        water: null,
        yieldG: null,
        milk: null,
        grind: null,
        tempC: null,
        sec: null,
        hours: null,
        pressure: null,
      };
      for (const f of fieldsFor(method, base)) {
        const raw = params[f.k];
        if (raw == null) continue;
        blank[f.k] = f.k === 'grind' ? clampGrind(raw, spec) : raw;
      }

      const values = {
        year: when.getFullYear(),
        mon: when.getMonth() + 1,
        day: when.getDate(),
        time: clock,
        drankAtMs: when.getTime(),
        method,
        base: method === '特调' ? (base ?? DEFAULT_BASE) : null,
        methodName: usesCustomName(method) ? trimOrNull(methodName) : null,
        brandId: targetBrand,
        beanId,
        ice: isIced ? true : null,
        rating,
        note: note.trim(),
        photo,
        gear: withGear ? gear : null,
        grinder: withGear ? grinder : null,
        gunit: withGear && spec ? spec.unit : null,
        ...blank,
      };

      if (editId) {
        await updateRecord(editId, values);
        router.back();
      } else {
        const newId = await insertRecord(values);
        router.replace({ pathname: '/', params: { saved: newId } });
      }
    } catch (e) {
      Alert.alert('没能保存', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const createBean = async (draft: BeanDraft) => {
    const id = await insertBean({
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
    setBeanId(id);
    setBeanSheet(false);
  };

  const createBrand = async () => {
    const name = newBrand.trim();
    if (!name) return;
    const id = await insertBrand(name);
    setBrandId(id);
    setNewBrand('');
    setBrandSheet(false);
  };

  if (!loaded) return <View style={styles.screen} />;


  return (
    <View style={styles.screen}>
      <NavBar
        title={isEdit ? '编辑记录' : '记一杯'}
        left={<NavAction label="取消" onPress={() => router.back()} />}
        right={<NavAction label="保存" onPress={() => void save()} strong />}
      />

      {/*
        `automaticallyAdjustKeyboardInsets` rather than a KeyboardAvoidingView:
        the note field sits near the bottom of a long form, and only the scroll
        view's own keyboard insets keep the focused input visible. Using both
        double-compensates and pushes the field above the fold.
      */}
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
          {/* 1 — 来源 */}
          <Segment
            options={[
              { value: 'shop', label: '门店' },
              { value: 'self', label: '自制' },
            ]}
            value={isSelf ? 'self' : 'shop'}
            onChange={pickSource}
          />

          {/*
            2 — the slot right under the source segment belongs to whichever
            source is selected. SPEC put 品牌 at step 8, but naming the shop is
            the first thing you know about a bought cup, and most cups are
            bought. 自制 keeps 沿用最近 here for the same reason.
          */}
          {!isSelf ? (
            <Block title="品牌">
              <View style={styles.chipRow}>
                {shopBrands.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.name}
                    selected={b.id === brandId}
                    onPress={() => setBrandId(b.id)}
                  />
                ))}
                <Tap onPress={() => setBrandSheet(true)} style={styles.newBrandChip}>
                  <Txt size={14} w="semi" c={color.accent700}>
                    ＋ 新品牌
                  </Txt>
                </Tap>
              </View>
            </Block>
          ) : null}

          {/* 沿用最近 (自制 only) */}
          {isSelf && presets.length > 0 ? (
            <Block title="沿用最近">
              <View style={styles.presetRow}>
                {presets.map((r) => {
                  const b = r.beanId ? beanMap.get(r.beanId) : undefined;
                  const label = b ? (b.farm ?? b.region ?? displayBeanName(b)) : '未选豆子';
                  const rr = isMethod(r.method)
                    ? ratioOf({
                        ...r,
                        base: r.base && isSpecialBase(r.base) ? r.base : null,
                        method: r.method,
                      })
                    : null;
                  return (
                    <Tap key={r.id} onPress={() => applyPreset(r)} style={styles.preset}>
                      <Txt size={13} w="semi" numberOfLines={1}>
                        {label} · {r.method}
                      </Txt>
                      {rr ? (
                        <Num size={12} c={color.accent700}>
                          {rr.value}
                        </Num>
                      ) : null}
                    </Tap>
                  );
                })}
              </View>
            </Block>
          ) : null}

          {/* 3 — 做法 + 冰/热 */}
          <Block title="做法">
            <View style={styles.methodGrid}>
              {METHODS.map((m) => {
                const on = m === method;
                return (
                  <Tap
                    key={m}
                    onPress={() => pickMethod(m)}
                    style={[
                      styles.methodCell,
                      on && { backgroundColor: METHOD_COLOR[m], borderColor: METHOD_COLOR[m] },
                    ]}
                  >
                    <Txt size={15} w={on ? 'semi' : 'regular'} c={on ? color.accent100 : color.text}>
                      {m}
                    </Txt>
                  </Tap>
                );
              })}
            </View>
            <Segment
              options={[
                { value: 'hot', label: '热' },
                { value: 'ice', label: '冰' },
              ]}
              value={isIced ? 'ice' : 'hot'}
              onChange={(v) => setIce(v === 'ice')}
              style={styles.iceSeg}
            />

            {/*
              特调 is built on something, and which something decides the whole
              parameter list — an espresso tonic and a cold brew tonic have
              nothing measurable in common.
            */}
            {method === '特调' ? (
              <View style={styles.baseBlock}>
                <Txt size={13} c={color.neutral700}>
                  基底
                </Txt>
                <Segment
                  options={SPECIAL_BASES.map((b) => ({ value: b, label: b }))}
                  value={base ?? DEFAULT_BASE}
                  onChange={pickBase}
                />
              </View>
            ) : null}
          </Block>

          {/* 4 — 豆子 */}
          <Block title="豆子">
            <Tap onPress={() => setBeanSheet(true)} style={styles.beanRow}>
              {selectedBean ? (
                <View
                  style={[styles.beanDot, { backgroundColor: swatchColor(selectedBean.swatch) }]}
                >
                  <Txt size={14} w="bold" c={inkFor(selectedBean.swatch)}>
                    {displayBeanName(selectedBean).slice(0, 1)}
                  </Txt>
                </View>
              ) : null}
              <View style={styles.flex}>
                <Txt size={15} w="semi" c={selectedBean ? color.text : color.neutral500}>
                  {selectedBean ? displayBeanName(selectedBean) : '选豆子（可留空）'}
                </Txt>
                {selectedBean && beanSub(selectedBean) ? (
                  <Txt size={12} c={color.neutral600} numberOfLines={1}>
                    {beanSub(selectedBean)}
                  </Txt>
                ) : null}
              </View>
              {selectedBean ? (
                <Tap onPress={() => setBeanId(null)} style={styles.clearBean}>
                  <Txt size={13} c={color.accent700}>
                    清除
                  </Txt>
                </Tap>
              ) : null}
              <Txt size={18} c={color.neutral400}>
                ›
              </Txt>
            </Tap>
          </Block>

          {/* 5 — 器具 / 磨豆机 (滴滤 + 自制 only) */}
          {usesGear(method, isSelf ? 'self' : 'shop') ? (
            <Block title="器具">
              <DevicePicker
                label="冲煮器具"
                options={brewDevices.map((d) => d.name)}
                value={gear}
                onPick={setGear}
                emptyHint="还没有冲煮器具，去「我的 → 我的设备」添加"
              />
              <DevicePicker
                label="磨豆机"
                options={grinderDevices.map((d) => d.name)}
                value={grinder}
                onPick={pickGrinder}
                emptyHint="还没有磨豆机，去「我的 → 我的设备」添加"
              />
            </Block>
          ) : null}

          {/* 其他 has no parameters, so it gets a name instead. */}
          {usesCustomName(method) ? (
            <Block title="做法名称">
              <Field
                label=""
                value={methodName}
                onChange={setMethodName}
                placeholder="虹吸 / 摩卡壶 / 气泡冷萃…"
              />
            </Block>
          ) : null}

          {/*
            6 — 参数. Hidden entirely for 其他: an empty card under a live ratio
            of "—" and a hint about editing numbers there are none of read as a
            rendering fault, not as an intentionally blank section.
          */}
          {rowFields.length > 0 || showGrindCard ? (
          <Block
            title="参数"
            right={
              <View style={styles.blockRight}>
                <Txt size={12} c={color.neutral600}>
                  {ratioLabel}
                </Txt>
                <Num size={17} c={color.accent700}>
                  {ratio ? ratio.value : '—'}
                </Num>
              </View>
            }
            left={
              <Tap onPress={clearAll} style={styles.clearAll}>
                <Txt size={12} c={color.accent700}>
                  全部留空
                </Txt>
              </Tap>
            }
          >
            <Txt size={11.5} c={color.neutral500} style={styles.paramHint}>
              点数字可直接输入，长按 ± 连续调
            </Txt>

            <View style={styles.paramCard}>
              {rowFields.map((f, i) => {
                const isGrind = f.k === 'grind';
                const unit = isGrind && spec ? spec.unit : f.unit === 'grind' ? '格' : f.unit;
                const dec = isGrind && spec ? spec.dec : f.dec;
                const raw = params[f.k];
                const value = isGrind ? clampGrind(raw, spec) : raw;
                const b = boundsOf(f);
                // The typing box edits the stored number, so it needs the raw
                // unit: 滴滤 time displays as 2:20 but is entered in seconds.
                const editUnit = f.unit === 'time' ? '秒' : f.unit === 'grind' ? unit : f.unit;
                return (
                  <View key={f.k}>
                    {i > 0 ? <Divider inset={14} /> : null}
                    <ParamRow
                      label={f.label}
                      sub={isGrind && !spec ? '选一台磨豆机后才有刻度' : undefined}
                      value={value}
                      step={b.step}
                      min={b.min}
                      max={b.max}
                      fallback={b.fallback}
                      format={(v) => paramDisplay(v, unit, dec)}
                      editUnit={editUnit}
                      onChange={(v) => setParam(f.k, v)}
                    />
                  </View>
                );
              })}
            </View>

            {showGrindCard && spec && grinder ? (
              <GrindCard
                spec={spec}
                value={clampGrind(params.grind, spec)}
                grinderName={grinder}
                recents={grindRecents}
                onChange={(v) => setParam('grind', v)}
              />
            ) : null}
          </Block>
          ) : null}

          {/* 7 — 评分 */}
          <Block title="评分">
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Tap
                  key={n}
                  onPress={() => setRating(rating === n ? null : n)}
                  style={styles.star}
                >
                  <Txt size={30} c={rating != null && n <= rating ? color.accent : color.neutral300}>
                    ★
                  </Txt>
                </Tap>
              ))}
            </View>
          </Block>

          {/* 8 — 照片 */}
          <Block title="照片">
            <PhotoField filename={photo} onChange={setPhoto} />
          </Block>

          {/* 9 — 备注 */}
          <Block title="备注">
            <Field
              label=""
              value={note}
              onChange={setNote}
              placeholder="今天这杯怎么样"
              multiline
            />
          </Block>

          {/* 10 — 时间 */}
          <Block title="时间">
            <Tap onPress={() => setTimeSheet(true)} style={styles.timeRow}>
              <Txt size={15} w="semi">
                {timeSummary}
              </Txt>
              <View style={styles.flex} />
              <Num size={19}>{clock}</Num>
              <Txt size={18} c={color.neutral400}>
                ›
              </Txt>
            </Tap>
          </Block>

          <PillButton
            label={saving ? '保存中…' : isEdit ? '保存修改' : '保存这一杯'}
            onPress={() => void save()}
            disabled={saving}
          />
      </ScrollView>

      <BeanSheet
        visible={beanSheet}
        beans={beans ?? []}
        selectedId={beanId}
        records={records ?? []}
        from="record"
        shopFirst={!isSelf}
        defaultMine={isSelf}
        onPick={setBeanId}
        onCreate={createBean}
        onClose={() => setBeanSheet(false)}
      />

      <TimeSheet
        visible={timeSheet}
        value={time}
        now={now}
        onChange={setTime}
        onClose={() => setTimeSheet(false)}
      />

      <Sheet
        visible={brandSheet}
        onClose={() => setBrandSheet(false)}
        title="新品牌"
        left={<NavAction label="取消" onPress={() => setBrandSheet(false)} />}
        right={<NavAction label="添加" onPress={() => void createBrand()} strong />}
        maxHeightRatio={0.5}
      >
        <View style={styles.brandSheetBody}>
          <Field
            label="品牌名称"
            value={newBrand}
            onChange={setNewBrand}
            placeholder="Manner"
            autoFocus
          />
        </View>
      </Sheet>
    </View>
  );
}

// ── local pieces ─────────────────────────────────────────────────────────────

function Block({
  title,
  left,
  right,
  children,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <GroupLabel style={styles.blockLabel}>{title}</GroupLabel>
        {left}
        <View style={styles.flex} />
        {right}
      </View>
      {children}
    </View>
  );
}

function DevicePicker({
  label,
  options,
  value,
  onPick,
  emptyHint,
}: {
  label: string;
  options: string[];
  value: string | null;
  onPick: (name: string) => void;
  emptyHint: string;
}) {
  return (
    <View style={styles.devicePicker}>
      <Txt size={13} c={color.neutral700}>
        {label}
      </Txt>
      {options.length === 0 ? (
        <Txt size={12.5} c={color.neutral500}>
          {emptyHint}
        </Txt>
      ) : (
        <View style={styles.chipRow}>
          {options.map((name) => (
            <Chip key={name} label={name} selected={name === value} onPress={() => onPick(name)} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  body: { padding: 16, gap: 22 },
  block: { gap: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blockLabel: { paddingBottom: 0 },
  blockRight: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  clearAll: { minHeight: 30, justifyContent: 'center' },

  presetRow: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    gap: 3,
    padding: 11,
    borderRadius: radius.small,
    backgroundColor: color.neutral100,
    ...shadowSm,
  },

  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodCell: {
    // Three per row with two 8pt gaps between them.
    width: '31.5%',
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.neutral100,
  },
  iceSeg: { marginTop: 2 },
  baseBlock: { gap: 8, marginTop: 4 },

  beanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    backgroundColor: color.neutral100,
    ...shadowSm,
  },
  beanDot: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBean: { paddingHorizontal: 8, minHeight: 34, justifyContent: 'center' },

  devicePicker: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  newBrandChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.accent,
  },

  paramHint: { paddingHorizontal: 6, marginTop: -2 },
  paramCard: {
    borderRadius: radius.card,
    backgroundColor: color.neutral100,
    paddingVertical: 4,
    ...shadowSm,
  },

  stars: { flexDirection: 'row', gap: 4 },
  star: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    backgroundColor: color.neutral100,
    ...shadowSm,
  },

  brandSheetBody: { padding: 16, paddingBottom: 16 },
});
