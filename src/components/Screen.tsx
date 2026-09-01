/**
 * Screen chrome: the frosted nav bar and the safe-area container every screen
 * sits in. SPEC § 其他 specifies the bar as a 94% bg tint over a 20px blur.
 */
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, MIN_TAP } from '@/theme';
import { Tap, Txt } from './ui';

export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/**
 * Large screen title, as used at the top of each tab's scroll content.
 * 30px / 700 per SPEC § 字号.
 */
export function ScreenTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <Txt size={30} w="bold" style={styles.tightTitle}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

/**
 * The translucent nav bar used on pushed screens.
 *
 * BlurView only frosts on iOS/Android natively; the 94% tint underneath is what
 * makes the bar legible either way, so it is painted as a real background
 * rather than relying on the blur alone.
 */
export function NavBar({
  title,
  left,
  right,
}: {
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 40 : 0}
      tint="light"
      style={[styles.navBar, { paddingTop: insets.top }]}
    >
      <View style={styles.navInner}>
        <View style={styles.navSide}>{left}</View>
        <Txt size={17} w="semi" numberOfLines={1} style={styles.navTitle}>
          {title}
        </Txt>
        <View style={[styles.navSide, styles.navSideRight]}>{right}</View>
      </View>
    </BlurView>
  );
}

/** "‹ 返回" style nav action. */
export function NavAction({
  label,
  onPress,
  chevron,
  strong,
}: {
  label: string;
  onPress: () => void;
  chevron?: boolean;
  strong?: boolean;
}) {
  return (
    <Tap onPress={onPress} style={styles.navAction}>
      {chevron ? (
        <Txt size={22} c={color.accent700} style={styles.chevron}>
          ‹
        </Txt>
      ) : null}
      <Txt size={16} w={strong ? 'semi' : 'regular'} c={color.accent700}>
        {label}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  tightTitle: { letterSpacing: -0.4 },
  navBar: {
    backgroundColor: color.glass,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP + 6,
    paddingHorizontal: 8,
  },
  navSide: { minWidth: 76, justifyContent: 'center' },
  navSideRight: { alignItems: 'flex-end' },
  navTitle: { flex: 1, textAlign: 'center' },
  navAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: MIN_TAP,
    paddingHorizontal: 8,
  },
  chevron: { lineHeight: 24 },
});
