/**
 * Root layout: loads fonts, runs migrations, then hands off to the tabs.
 *
 * Nothing renders until both the fonts and the schema are ready. Rendering the
 * timeline against an un-migrated database would throw on the first query, and
 * rendering before Caprasimo lands would flash every number in the fallback
 * face — the one thing SPEC calls the design's main visual characteristic.
 */
// Deep imports, not the package roots: the barrel files require every weight
// the family ships, which drags ~1MB of unused faces into the bundle and makes
// each Expo Go reload slower.
import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo/400Regular';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlertHost } from '@/components/AlertHost';
import { bootstrap } from '@/db/bootstrap';
import { runMigrations } from '@/db/migrate';
import { exportBackup } from '@/lib/backup';
import { setupPwa } from '@/lib/pwa';
import { color } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Racing an already-hidden splash is harmless.
});

// Web only: service worker and durable storage. No-op on native.
setupPwa();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<Error | null>(null);

  // Migrations then the reserved 自制 brand, in that order, once.
  useEffect(() => {
    let cancelled = false;
    runMigrations()
      .then(bootstrap)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setBootError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fatal = bootError ?? fontError;
  const booted = (fontsLoaded || Boolean(fontError)) && ready;

  useEffect(() => {
    if (booted || fatal) SplashScreen.hideAsync().catch(() => {});
  }, [booted, fatal]);

  if (fatal) return <StartupFailure error={fatal} />;

  if (!booted) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="record/edit" options={{ presentation: 'modal' }} />
        </Stack>
        <AlertHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Shown when migrations or the fonts fail, instead of the app.
 *
 * The escape hatch matters more than the message: a failed migration leaves the
 * database on disk and readable, but with no UI mounted the user cannot reach
 * the export button under 我的, so their only recovery would be deleting the app
 * — which is the one action that actually destroys the data. The rescue export
 * reads each table independently and saves whatever survives.
 *
 * Deliberately styled with no custom fontFamily: a font load failure is one of
 * the states that lands here, and this screen has to render in that state.
 */
function StartupFailure({ error }: { error: Error }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rescue = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const n = await exportBackup({ rescue: true });
      setStatus(
        n == null
          ? '备份文件生成了，但这台设备没有可用的分享面板。'
          : `已导出 ${n} 条记录，在分享面板里存到「文件」或发给自己。`,
      );
    } catch (e) {
      setStatus(`抢救导出也失败了：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>数据库没能启动</Text>
      <Text style={styles.errorBody}>{error.message}</Text>
      <Text style={styles.errorHint}>数据没有被清掉，还在手机上。先把它导出来，再去修迁移。</Text>
      <Text style={styles.errorHint}>在修好之前，不要删除 App —— 删掉才是真的没了。</Text>

      <Pressable
        onPress={() => void rescue()}
        disabled={busy}
        style={({ pressed }) => [styles.rescueBtn, (busy || pressed) && styles.rescueBtnDim]}
      >
        <Text style={styles.rescueLabel}>{busy ? '导出中…' : '抢救导出'}</Text>
      </Pressable>

      {status ? <Text style={styles.errorBody}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: color.bg,
  },
  errorTitle: { fontWeight: '600', fontSize: 17, color: color.text },
  errorBody: { fontSize: 13, color: color.neutral700, textAlign: 'center' },
  errorHint: {
    fontSize: 13,
    lineHeight: 20,
    color: color.text,
    textAlign: 'center',
    marginTop: 4,
  },
  rescueBtn: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.accent,
  },
  rescueBtnDim: { opacity: 0.6 },
  rescueLabel: { fontSize: 15, fontWeight: '600', color: color.accent100 },
});
