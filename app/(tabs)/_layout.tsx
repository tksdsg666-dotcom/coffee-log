/**
 * The three tabs from SPEC § 屏幕: 时间线 / 豆子 / 我的.
 * Icons are Lucide `list` / `coffee` / `user` at stroke-width 2.75.
 */
import { Tabs } from 'expo-router';
import { Coffee, List, User } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, weight } from '@/theme';

const STROKE = 2.75;

/**
 * The bar's own height, above the home indicator.
 *
 * It has to be added to the inset by hand. `getTabBarHeight` treats a numeric
 * `height` in `tabBarStyle` as the **total**, while the bar separately applies
 * `paddingBottom: insets.bottom` — so a flat 62 on an iPhone leaves 22pt for an
 * icon and a label, and the label silently disappears. A per-platform constant
 * cannot express this either: the same iPhone reports `ios` in Expo Go and
 * `web` in the PWA, with the same 34pt indicator underneath both.
 */
const BAR_HEIGHT = 58;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.neutral500,
        tabBarStyle: [styles.bar, { height: BAR_HEIGHT + insets.bottom }],
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '时间线',
          tabBarIcon: ({ color: c, size }) => <List color={c} size={size} strokeWidth={STROKE} />,
        }}
      />
      <Tabs.Screen
        name="beans"
        options={{
          title: '豆子',
          tabBarIcon: ({ color: c, size }) => <Coffee color={c} size={size} strokeWidth={STROKE} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我的',
          tabBarIcon: ({ color: c, size }) => <User color={c} size={size} strokeWidth={STROKE} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.glass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    paddingTop: 6,
  },
  label: {
    fontFamily: font.bodySemi,
    fontWeight: weight.semi,
    fontSize: 11,
  },
});
