/**
 * Shared primitives.
 *
 * `Num` exists because of one SPEC rule: every number in the app — cup counts,
 * ratios, parameter values, clock times — is set in Caprasimo, and that face
 * carries no CJK glyphs. Keeping numbers in their own component stops the
 * heading face from leaking onto Chinese text, where it would silently fall
 * back and lose its weight.
 */
import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { color, font, radius, shadowSm, weight } from '@/theme';

// ── text ─────────────────────────────────────────────────────────────────────

type TxtProps = TextProps & {
  size?: number;
  /** Maps to the Figtree cut and the matching numeric weight for CJK fallback. */
  w?: 'regular' | 'semi' | 'bold';
  c?: string;
  children?: ReactNode;
};

export function Txt({ size = 15, w = 'regular', c = color.text, style, ...rest }: TxtProps) {
  const family = w === 'bold' ? font.bodyBold : w === 'semi' ? font.bodySemi : font.body;
  return (
    <Text
      {...rest}
      style={[{ fontFamily: family, fontWeight: weight[w], fontSize: size, color: c }, style]}
    />
  );
}

type NumProps = TextProps & { size?: number; c?: string; children?: ReactNode };

/** Caprasimo. Use for digits only. */
export function Num({ size = 17, c = color.text, style, ...rest }: NumProps) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: font.heading, fontWeight: '400', fontSize: size, color: c }, style]}
    />
  );
}

// ── grouping ─────────────────────────────────────────────────────────────────

/** The 12px / 0.1em uppercase-ish group heading used above every list block. */
export function GroupLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.groupLabel, style]}>
      <Txt size={12} w="semi" c={color.neutral600} style={styles.tracked}>
        {children}
      </Txt>
    </View>
  );
}

/** Rounded neutral-100 container that list rows sit inside. */
export function Card({ style, children, ...rest }: ViewProps & { children?: ReactNode }) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

/** 1px hairline between rows inside a Card. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

// ── pressables ───────────────────────────────────────────────────────────────

type TapProps = Omit<PressableProps, 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Pressable with the design system's uniform press feedback and 44pt target. */
export function Tap({ children, style, ...rest }: TapProps) {
  return (
    <Pressable
      hitSlop={8}
      {...rest}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** Pill button. `tone` picks between the filled accent and the outlined form. */
export function PillButton({
  label,
  onPress,
  tone = 'filled',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'filled' | 'outline' | 'quiet';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = tone === 'filled';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        filled && { backgroundColor: color.accent },
        tone === 'outline' && styles.pillOutline,
        tone === 'quiet' && { backgroundColor: color.neutral100 },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Txt size={15} w="semi" c={filled ? color.accent100 : color.accent700}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Small selectable chip — brands, processes, roasts, grind presets. */
export function Chip({
  label,
  selected,
  onPress,
  tint,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Overrides the selected background, for method-coloured chips. */
  tint?: string;
}) {
  const bg = selected ? (tint ?? color.accent) : color.neutral100;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderColor: selected ? bg : color.hairline },
        pressed && styles.pressed,
      ]}
    >
      <Txt size={14} w={selected ? 'semi' : 'regular'} c={selected ? color.accent100 : color.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ── segmented control ────────────────────────────────────────────────────────

/** iOS-style segmented control: a neutral track with a raised active thumb. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segTrack, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && styles.segItemOn]}
          >
            <Txt size={15} w={on ? 'semi' : 'regular'} c={on ? color.text : color.neutral600}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── stars ────────────────────────────────────────────────────────────────────

/** Read-only star row for cards and detail headers. */
export function StarText({ rating, size = 14 }: { rating: number | null; size?: number }) {
  if (rating == null) return null;
  return (
    <Text style={[styles.starText, { fontSize: size }]}>
      <Text style={{ color: color.accent }}>{'★'.repeat(rating)}</Text>
      <Text style={{ color: color.neutral300 }}>{'☆'.repeat(5 - rating)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  groupLabel: { paddingHorizontal: 6, paddingBottom: 8 },
  tracked: { letterSpacing: 1.2 },
  card: {
    backgroundColor: color.neutral100,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadowSm,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.4 },
  pill: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: color.accent,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: color.neutral200,
    borderRadius: radius.pill,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segItemOn: {
    backgroundColor: color.neutral100,
    ...shadowSm,
  },
  starText: { letterSpacing: 1.5 },
});
