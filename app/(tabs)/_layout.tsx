/**
 * The three tabs from SPEC § 屏幕: 时间线 / 豆子 / 我的.
 * Icons are Lucide `list` / `coffee` / `user` at stroke-width 2.75.
 */
import { Tabs } from 'expo-router';
import { Coffee, List, User } from 'lucide-react-native';
import { Platform, StyleSheet } from 'react-native';

import { color, font, weight } from '@/theme';

const STROKE = 2.75;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.neutral500,
        tabBarStyle: styles.bar,
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
    // The default 49pt bar crowds the 2.75-weight icons.
    height: Platform.OS === 'ios' ? 84 : 62,
    paddingTop: 6,
  },
  label: {
    fontFamily: font.bodySemi,
    fontWeight: weight.semi,
    fontSize: 11,
  },
});
