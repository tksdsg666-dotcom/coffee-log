/**
 * Organic design tokens, ported from the styles.css under docs/design/_ds.
 *
 * The CSS is the source of truth for the look. React Native has no CSS custom
 * properties and no color-mix(), so every color-mix() in the stylesheet is
 * resolved here at author time — the comment on each one records the original
 * expression so a retune upstream can be traced back.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import type { Method } from '@/domain/methods';

export const color = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',

  /** color-mix(in srgb, #201e1d 16%, transparent) */
  divider: 'rgba(32, 30, 29, 0.16)',
  /** 1px hairline used between list rows — 7% in the prototype, not the 16% token */
  hairline: 'rgba(32, 30, 29, 0.07)',

  neutral100: '#f9f4ed',
  neutral200: '#eee7db',
  neutral300: '#dcd3c4',
  neutral400: '#c0b6a5',
  neutral500: '#a19786',
  neutral600: '#82796a',
  neutral700: '#645c50',
  neutral800: '#474238',
  neutral900: '#2e2b25',

  accent: '#c67139',
  accent100: '#fff2eb',
  accent200: '#ffe1d0',
  accent300: '#ffc6a5',
  accent400: '#f6a06b',
  accent500: '#d67f48',
  accent600: '#b2622d',
  accent700: '#8c491a',
  accent800: '#643312',
  accent900: '#402310',

  accent2: '#7a8a5e',
  accent2_100: '#f0fae1',
  accent2_200: '#e1eecc',
  accent2_300: '#ccdbb2',
  accent2_400: '#aebf92',
  accent2_500: '#8fa073',
  accent2_600: '#728157',
  accent2_700: '#56633f',
  accent2_800: '#3d472b',
  accent2_900: '#272e1b',

  /** color-mix(in srgb, var(--color-bg) 94%, transparent) — the frosted bar tint */
  glass: 'rgba(245, 234, 216, 0.94)',
  /** pressed-state wash over a card */
  pressWash: 'rgba(32, 30, 29, 0.04)',
} as const;

export const font = {
  /** Caprasimo. SPEC: every number in the app is set in this face. */
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

/**
 * Latin faces carry no CJK glyphs, so iOS/Android fall back per-glyph to the
 * system Chinese face (PingFang SC / Noto Sans CJK). That is exactly the
 * behaviour the CSS asked for, so Chinese text needs no special casing —
 * but weight has to be set explicitly, because the fallback face does not
 * inherit the bundled family's weight.
 */
export const weight = {
  regular: '400',
  semi: '600',
  bold: '700',
} satisfies Record<string, TextStyle['fontWeight']>;

export const space = {
  s1: 4.4,
  s2: 8.8,
  s3: 13.2,
  s4: 17.6,
  s6: 26.4,
  s8: 35.2,
} as const;

/** Radii called out by name in SPEC § Design Tokens. */
export const radius = {
  pill: 999,
  sheet: 28,
  summary: 26,
  stat: 22,
  card: 20,
  small: 18,
  wheelItem: 14,
  number: 12,
} as const;

const shadow = (offsetY: number, blur: number, opacity: number, elevation: number) =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: color.neutral900,
      shadowOffset: { width: 0, height: offsetY },
      // CSS blur radius is roughly twice the Core Graphics blur radius.
      shadowRadius: blur / 2,
      shadowOpacity: opacity,
    },
    default: { elevation },
  })!;

/** 0 1px 2px rgba(46,43,37,.14) */
export const shadowSm = shadow(1, 2, 0.14, 1);
/** 0 3px 10px rgba(46,43,37,.16) */
export const shadowMd = shadow(3, 10, 0.16, 4);
/** 0 12px 32px rgba(46,43,37,.22) */
export const shadowLg = shadow(12, 32, 0.22, 12);

/** SPEC: touch targets are at least 44×44, widened with negative margins. */
export const HIT = { top: 10, bottom: 10, left: 10, right: 10 } as const;
export const MIN_TAP = 44;

/**
 * Method colours. Three roles, not one.
 *
 * SPEC gave each 做法 a single colour used for both the dot and the pill text,
 * which measures badly: 奶咖's accent-400 rendered at contrast 1.89 against its
 * tint, far under the 4.5 a label needs, and the whole set collapsed to a
 * minimum perceptual difference of ΔE 17.8. The two jobs pull opposite ways —
 * text has to be dark to be legible, and everything being dark is exactly what
 * destroys the separation between categories.
 *
 * Splitting them lets each be chosen for its own job: DOT carries the identity
 * (searched over the palette for the widest mutual ΔE, now 22.2), INK is a dark
 * relative of it for the label (worst contrast now 8.12), TINT is the pill
 * background. accent-300 and accent-400 are excluded throughout — they read
 * pink and orange against an app that is otherwise brown.
 *
 * These live here rather than beside the method config so
 * `src/domain/methods.ts` stays free of any React Native import.
 */
export const METHOD_COLOR: Record<Method, string> = {
  滴滤: color.accent,
  美式: color.accent900,
  奶咖: color.accent700,
  冷萃: color.accent2,
  特调: color.accent2_800,
  其他: color.neutral600,
};

/** Label colour inside a method pill — a dark relative of its dot. */
export const METHOD_INK: Record<Method, string> = {
  滴滤: color.accent800,
  美式: color.accent900,
  奶咖: color.accent900,
  冷萃: color.accent2_800,
  特调: color.accent2_900,
  其他: color.neutral800,
};

/** Pill background per method. */
export const METHOD_TINT: Record<Method, string> = {
  滴滤: color.accent100,
  美式: color.neutral200,
  奶咖: color.accent200,
  冷萃: color.accent2_100,
  特调: color.accent2_200,
  其他: color.neutral200,
};
