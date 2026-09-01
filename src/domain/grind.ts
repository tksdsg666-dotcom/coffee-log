/**
 * Grind is the one parameter whose scale is not fixed by the method — it comes
 * from whichever grinder is selected (SPEC § 研磨刻度). Every read and write
 * clamps to that grinder's range and snaps to its step, and the unit is copied
 * onto the record so history keeps rendering in its own unit.
 */
import type { Device } from '@/db/schema';

export type GrindSpec = {
  step: number;
  min: number;
  max: number | null;
  unit: string;
  /** Decimal places — a sub-1 step means one decimal. */
  dec: 0 | 1;
  def: number;
};

export const grindSpecOf = (grinder: Device | null | undefined): GrindSpec | null => {
  if (!grinder || !grinder.isGrinder) return null;
  const step = grinder.gstep ?? 1;
  const min = grinder.gmin ?? 1;
  return {
    step,
    min,
    max: grinder.gmax ?? null,
    unit: grinder.gunit ?? '格',
    dec: step < 1 ? 1 : 0,
    def: grinder.gdef ?? min,
  };
};

/** Snap to the grinder's step, then clamp into its range. */
export const clampGrind = (v: number | null | undefined, spec: GrindSpec | null): number | null => {
  if (v == null || !spec) return v ?? null;
  const snapped = Math.round(v / spec.step) * spec.step;
  const clamped = Math.min(spec.max ?? snapped, Math.max(spec.min, snapped));
  // Re-round to kill float drift from the divide/multiply above.
  return Math.round(clamped * 100) / 100;
};

/**
 * "24" / "5.6" — the number alone.
 *
 * Pass `dec` wherever the grinder is known; it is the only reliable source of
 * precision. Without it this falls back to a guess, because a saved record
 * keeps the unit but not the step: a 0.1-step grinder that happens to be dialled
 * to a whole number would otherwise render as "6" next to a sibling "7.9".
 */
export const grindNumber = (
  grind: number,
  gunit: string | null | undefined,
  dec?: 0 | 1,
): string => {
  const places = dec ?? (gunit === '圈' || !Number.isInteger(grind) ? 1 : 0);
  return places ? grind.toFixed(1) : String(grind);
};

/** "24格" / "5.6圈" */
export const grindText = (
  grind: number,
  gunit: string | null | undefined,
  dec?: 0 | 1,
): string => grindNumber(grind, gunit, dec) + (gunit ?? '格');

/** Default dial for a newly added grinder: the midpoint, snapped to its step. */
export const midpointDefault = (min: number, max: number, step: number): number => {
  const mid = min + (max - min) / 2;
  return Math.round(Math.round(mid / step) * step * 100) / 100;
};
