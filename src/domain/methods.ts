/**
 * The 做法 and their parameter configuration.
 *
 * Ported from the prototype's FIELDS / DEFAULTS tables (docs/design/SPEC.md
 * § 做法与参数), then extended in two ways experience asked for:
 *
 *   - 特调 and 其他 are separate. They were one bucket, but a specialty drink
 *     has parameters worth recording and a genuinely uncategorised cup has
 *     none, so lumping them meant one of the two was always wrong.
 *   - 特调 carries a base (浓缩 / 冷萃 / 滴滤) and takes that base's extraction
 *     parameters, because the same drink is built on espresso in one shop and
 *     on cold brew or ice drip in the next.
 *
 * 挂耳 has no entry of its own: it is drip, and belongs under 滴滤.
 */

export const METHODS = ['滴滤', '美式', '奶咖', '冷萃', '特调', '其他'] as const;
export type Method = (typeof METHODS)[number];

export const isMethod = (v: string): v is Method => (METHODS as readonly string[]).includes(v);

/** What a 特调 is built on. Only 特调 uses this. */
export const SPECIAL_BASES = ['浓缩', '冷萃', '滴滤'] as const;
export type SpecialBase = (typeof SPECIAL_BASES)[number];

export const isSpecialBase = (v: string): v is SpecialBase =>
  (SPECIAL_BASES as readonly string[]).includes(v);

export const DEFAULT_BASE: SpecialBase = '浓缩';

/** Keys of the numeric parameter columns on a record. */
export type ParamKey =
  | 'dose'
  | 'water'
  | 'yieldG'
  | 'milk'
  | 'grind'
  | 'tempC'
  | 'sec'
  | 'hours'
  | 'pressure';

export type ParamUnit = 'g' | 'ml' | '°C' | 'time' | '秒' | '小时' | 'bar' | 'grind';

export type ParamField = {
  k: ParamKey;
  label: string;
  unit: ParamUnit;
  step: number;
  min: number;
  /**
   * Upper bound. SPEC gives only a lower bound per field, but a bounded range
   * keeps ± from running away; these sit well past any plausible cup. Grind
   * ignores this and takes its range from the grinder instead.
   */
  max?: number;
  /** Decimal places to render. Grind overrides this from the grinder spec. */
  dec?: number;
};

const DOSE: ParamField = { k: 'dose', label: '粉量', unit: 'g', step: 0.5, min: 5, max: 60 };
const ESPRESSO_DOSE: ParamField = { ...DOSE, label: '浓缩粉量', max: 40 };
const YIELD: ParamField = { k: 'yieldG', label: '浓缩液重', unit: 'g', step: 1, min: 5, max: 120 };
const DRIP_WATER: ParamField = { k: 'water', label: '水量', unit: 'g', step: 5, min: 50, max: 1200 };
// 0–100 rather than 60–100: cold-brew-adjacent and ice-drip recipes use water
// well below anything a hot brew would.
const TEMP: ParamField = { k: 'tempC', label: '水温', unit: '°C', step: 1, min: 0, max: 100 };
const DRIP_TIME: ParamField = { k: 'sec', label: '时间', unit: 'time', step: 5, min: 30, max: 900 };
const SHOT_TIME: ParamField = { k: 'sec', label: '时间', unit: '秒', step: 1, min: 5, max: 120 };
const GRIND: ParamField = { k: 'grind', label: '研磨', unit: 'grind', step: 1, min: 1 };
/** Only the espresso family has a pump behind it. */
const PRESSURE: ParamField = { k: 'pressure', label: '压强', unit: 'bar', step: 0.5, min: 1, max: 15 };

/** The other liquid in a 特调 — syrup, tonic, juice, milk. */
const OTHER_LIQUID: ParamField = {
  k: 'milk',
  label: '奶 / 其他液体',
  unit: 'ml',
  step: 10,
  min: 0,
  max: 800,
};

/** Extraction parameters for each 特调 base, before the other liquid. */
const BASE_FIELDS: Record<SpecialBase, readonly ParamField[]> = {
  浓缩: [ESPRESSO_DOSE, YIELD, SHOT_TIME, TEMP, PRESSURE],
  冷萃: [
    { k: 'dose', label: '粉量', unit: 'g', step: 5, min: 10, max: 300 },
    { k: 'water', label: '水量', unit: 'g', step: 50, min: 100, max: 3000 },
    { k: 'hours', label: '浸泡', unit: '小时', step: 1, min: 1, max: 72 },
  ],
  滴滤: [DOSE, DRIP_WATER, TEMP, DRIP_TIME],
};

const FIXED_FIELDS: Record<Exclude<Method, '特调'>, readonly ParamField[]> = {
  滴滤: [DOSE, DRIP_WATER, GRIND, TEMP, DRIP_TIME],
  美式: [
    { ...DOSE, max: 40 },
    YIELD,
    { k: 'water', label: '加水', unit: 'ml', step: 10, min: 0, max: 600 },
    SHOT_TIME,
    TEMP,
    PRESSURE,
  ],
  奶咖: [
    ESPRESSO_DOSE,
    YIELD,
    { k: 'milk', label: '奶量', unit: 'ml', step: 10, min: 30, max: 800 },
    TEMP,
    PRESSURE,
  ],
  冷萃: BASE_FIELDS.冷萃,
  // Genuinely uncategorised: a rating, a note and a photo are the whole record.
  其他: [],
};

/** The parameter list for a method, given its base when it has one. */
export const fieldsFor = (method: Method, base: SpecialBase | null): readonly ParamField[] =>
  method === '特调'
    ? [...BASE_FIELDS[base ?? DEFAULT_BASE], OTHER_LIQUID]
    : FIXED_FIELDS[method];

const FIXED_DEFAULTS: Record<Exclude<Method, '特调'>, Partial<Record<ParamKey, number>>> = {
  滴滤: { dose: 15, water: 240, tempC: 92, sec: 140 },
  美式: { dose: 18, yieldG: 36, water: 120, sec: 27, tempC: 93, pressure: 9 },
  奶咖: { dose: 18, yieldG: 36, milk: 180, tempC: 93, pressure: 9 },
  冷萃: { dose: 60, water: 600, hours: 14 },
  其他: {},
};

const BASE_DEFAULTS: Record<SpecialBase, Partial<Record<ParamKey, number>>> = {
  浓缩: { dose: 18, yieldG: 36, sec: 27, tempC: 93, pressure: 9, milk: 120 },
  冷萃: { dose: 60, water: 600, hours: 14, milk: 120 },
  滴滤: { dose: 15, water: 240, tempC: 92, sec: 140, milk: 120 },
};

/** Values a 自制 cup starts at, and what a cleared field is restored to. */
export const defaultsFor = (
  method: Method,
  base: SpecialBase | null,
): Partial<Record<ParamKey, number>> =>
  method === '特调' ? BASE_DEFAULTS[base ?? DEFAULT_BASE] : FIXED_DEFAULTS[method];

/** 其他 is the only method that carries a name the user typed. */
export const usesCustomName = (method: Method) => method === '其他';

/** 研磨 is only asked for on a self-made pour-over. */
export const usesGrindCard = (method: Method, brandId: string) =>
  method === '滴滤' && brandId === 'self';

/** Same condition gear/grinder are stored under. */
export const usesGear = usesGrindCard;

/** Empty parameter set — 门店 records start here and stay here. */
export const blankParams = (
  method: Method,
  base: SpecialBase | null,
): Record<ParamKey, number | null> => {
  const out = {} as Record<ParamKey, number | null>;
  for (const f of fieldsFor(method, base)) out[f.k] = null;
  return out;
};

/** Default parameter set — what 自制 starts at. */
export const defaultParams = (
  method: Method,
  base: SpecialBase | null,
): Record<ParamKey, number | null> => {
  const defaults = defaultsFor(method, base);
  const out = {} as Record<ParamKey, number | null>;
  for (const f of fieldsFor(method, base)) out[f.k] = defaults[f.k] ?? null;
  return out;
};
