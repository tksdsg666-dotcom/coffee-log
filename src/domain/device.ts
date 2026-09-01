/**
 * Device kinds and the brew/grinder split derived from them (SPEC § Device).
 */
export type DeviceKindSpec = {
  kind: string;
  isBrew: boolean;
  isGrinder: boolean;
  /** Suggested dial defaults, offered when adding a grinder. */
  gstep?: number;
  gmin?: number;
  gmax?: number;
  gunit?: string;
};

export const DEVICE_KINDS: readonly DeviceKindSpec[] = [
  { kind: '滤杯', isBrew: true, isGrinder: false },
  { kind: '滴滤机', isBrew: true, isGrinder: false },
  { kind: '浸泡滤杯', isBrew: true, isGrinder: false },
  { kind: '咖啡机', isBrew: true, isGrinder: false },
  { kind: '手磨', isBrew: false, isGrinder: true, gstep: 1, gmin: 1, gmax: 40, gunit: '格' },
  { kind: '电动磨', isBrew: false, isGrinder: true, gstep: 1, gmin: 1, gmax: 20, gunit: '档' },
  { kind: '电子秤', isBrew: false, isGrinder: false },
];

export const kindSpec = (kind: string): DeviceKindSpec | undefined =>
  DEVICE_KINDS.find((k) => k.kind === kind);

/** Grind units offered when adding a grinder. */
export const GRIND_UNITS = ['格', '圈', '档'] as const;

/** SPEC: adding a grinder asks for precision (integer / one decimal) and range. */
export const GRIND_PRECISIONS = [
  { step: 1, label: '整数', hint: '如 24 格' },
  { step: 0.1, label: '一位小数', hint: '如 5.6 圈' },
] as const;
