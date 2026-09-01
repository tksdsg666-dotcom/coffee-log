/**
 * How beans get ordered in the picker and the list.
 *
 * Creation order is the wrong default once there are more than a handful. Both
 * places want the same thing — what have I been drinking — so both sort by how
 * recently a bean was last drunk. Which *group* leads is decided by the caller:
 * the picker follows the cup being logged, the tab follows the saved default.
 *
 * Free of any React Native import, so it can be exercised directly.
 */
import type { Bean, CoffeeRecord } from '@/db/schema';

export type BeanUsage = {
  /** When this bean was last drunk, or null if it never has been. */
  lastDrankAtMs: number | null;
};

export const beanUsage = (records: CoffeeRecord[]): Map<string, BeanUsage> => {
  const out = new Map<string, BeanUsage>();
  for (const r of records) {
    if (!r.beanId) continue;
    const seen = out.get(r.beanId)?.lastDrankAtMs ?? null;
    if (seen == null || r.drankAtMs > seen) out.set(r.beanId, { lastDrankAtMs: r.drankAtMs });
  }
  return out;
};

/**
 * Most recently drunk first; never-drunk beans fall to the end, newest first.
 *
 * The createdAt tiebreak makes the order total. Without it two beans with the
 * same history compare equal, and a sort that is not stable across renders
 * makes the list visibly reshuffle.
 */
export const sortByLastDrunk = (beans: Bean[], usage: Map<string, BeanUsage>): Bean[] =>
  [...beans].sort((a, b) => {
    const la = usage.get(a.id)?.lastDrankAtMs ?? -1;
    const lb = usage.get(b.id)?.lastDrankAtMs ?? -1;
    if (lb !== la) return lb - la;
    return b.createdAt - a.createdAt;
  });
