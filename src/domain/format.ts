/**
 * Display formatting: ratios, the timeline parameter string, times and dates.
 * Ported from the prototype's ratioOf / paramText / mmss helpers.
 */
import type { CoffeeRecord } from '@/db/schema';
// Explicit extension so `npm test` can load this module under Node's ESM
// resolver, which does not guess one. Metro resolves the exact path too.
import { grindText } from './grind.ts';
import { DEFAULT_BASE, type Method, type SpecialBase } from './methods.ts';

/** One decimal, always shown — "16.0", not "16". */
export const one = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** Trims a trailing ".0" so "15" stays "15" but "15.5" survives. */
export const num = (n: number): string => (n % 1 === 0 ? String(n) : one(n));

/** 140 -> "2:20" */
export const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export type Ratio = { label: string; value: string };

/** The shape ratioOf needs — a saved record, or the in-progress form state. */
export type RatioInput = {
  method: Method;
  /** Only read for 特调, whose ratio follows whatever it is built on. */
  base?: SpecialBase | null;
  dose?: number | null;
  water?: number | null;
  yieldG?: number | null;
  milk?: number | null;
};

/** Which ratio a method reports — 特调 borrows its base's. */
const ratioKindOf = (method: Method, base: SpecialBase | null | undefined) => {
  const effective = method === '特调' ? (base ?? DEFAULT_BASE) : method;
  if (effective === '滴滤' || effective === '冷萃') return 'brew' as const;
  if (effective === '美式' || effective === '浓缩') return 'shot' as const;
  if (effective === '奶咖') return 'milk' as const;
  return null;
};

/**
 * SPEC § 做法与参数: each method has its own ratio, and a missing numerator or
 * denominator renders as "—" rather than as a computed zero.
 */
export const ratioOf = (r: RatioInput): Ratio | null => {
  const kind = ratioKindOf(r.method, r.base);
  if (kind === 'brew') {
    if (!r.dose || !r.water) return null;
    return { label: '粉水比', value: `1:${one(r.water / r.dose)}` };
  }
  if (kind === 'shot') {
    if (!r.dose || !r.yieldG) return null;
    return { label: '萃取比', value: `1:${one(r.yieldG / r.dose)}` };
  }
  if (kind === 'milk') {
    if (!r.yieldG || !r.milk) return null;
    return { label: '奶咖比', value: `1:${one(r.milk / r.yieldG)}` };
  }
  // 其他 records nothing to take a ratio of.
  return null;
};

/** Label for the ratio slot before enough fields are filled to compute one. */
export const ratioLabelOf = (method: Method, base: SpecialBase | null): string => {
  const kind = ratioKindOf(method, base);
  if (kind === 'brew') return '粉水比';
  if (kind === 'shot') return '萃取比';
  if (kind === 'milk') return '奶咖比';
  return '比例';
};

/**
 * The one-line parameter string under a timeline card.
 * SPEC fixes the order: 器具 → 粉量 → 水量/加水 → 液重 → 奶/液体 → 研磨 → 水温 → 时间 → 浸泡.
 */
export const paramText = (r: CoffeeRecord): string => {
  const out: string[] = [];
  if (r.gear) out.push(r.gear);
  if (r.dose) out.push(`${num(r.dose)}g 粉`);
  if (r.water && r.method !== '美式') out.push(`${num(r.water)}g 水`);
  if (r.method === '美式' && r.water) out.push(`加水 ${num(r.water)}ml`);
  if (r.yieldG) out.push(`液重 ${num(r.yieldG)}g`);
  if (r.milk) out.push(`${r.method === '特调' ? '液体' : '奶'} ${num(r.milk)}ml`);
  if (r.grind != null) out.push(`${r.grinder ? `${r.grinder} ` : '研磨 '}${grindText(r.grind, r.gunit)}`);
  else if (r.grinder) out.push(r.grinder);
  if (r.tempC) out.push(`${r.tempC}°C`);
  if (r.sec) out.push(r.method === '美式' ? `${r.sec}″` : mmss(r.sec));
  if (r.hours) out.push(`浸泡 ${r.hours}h`);
  if (r.pressure) out.push(`${num(r.pressure)}bar`);
  return out.join(' · ');
};

/** Renders one parameter value the way the form and detail rows show it. */
export const paramDisplay = (v: number | null, unit: string, dec?: number): string => {
  if (v == null) return '—';
  if (unit === 'time') return mmss(v);
  if (unit === '秒') return `${v}″`;
  if (unit === '°C') return `${v}°`;
  if (unit === '小时') return `${v}小时`;
  if (unit === 'bar') return `${num(v)}bar`;
  const n = dec ? v.toFixed(dec) : num(v);
  return n + unit;
};

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole days between two dates, ignoring time of day. */
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);

/** "8 月 26 日" */
export const monthDay = (mon: number, day: number): string => `${mon} 月 ${day} 日`;

/**
 * The subtitle under a timeline group heading: 今天 / 昨天, otherwise the weekday.
 */
export const dayLabel = (year: number, mon: number, day: number, now: Date): string => {
  const d = new Date(year, mon - 1, day);
  const diff = daysBetween(now, d);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return WEEKDAYS[d.getDay()] ?? '';
};

/** Sort/group key: descending by this puts the newest day first. */
export const dayKey = (year: number, mon: number, day: number): number =>
  year * 10_000 + mon * 100 + day;

export const pad2 = (n: number): string => String(n).padStart(2, '0');
