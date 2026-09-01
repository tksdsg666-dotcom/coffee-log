/**
 * 照片 — "＋ 加一张照片" opening a 拍照 / 从相册选 action sheet, then a preview
 * with a remove control (SPEC § 照片).
 *
 * The picked file is copied into permanent storage immediately rather than at
 * save time: the picker's URI lives in the cache directory, and a form left
 * open across a memory-pressure purge would otherwise save a dangling path.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';

import { deletePhoto, photoUri, savePhoto } from '@/lib/photos';
import { color, MIN_TAP, radius } from '@/theme';
import { Sheet } from './Sheet';
import { NavAction } from './Screen';
import { Tap, Txt } from './ui';

export function PhotoField({
  filename,
  onChange,
}: {
  filename: string | null;
  /** Receives the stored filename, or null when removed. */
  onChange: (filename: string | null) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const uri = photoUri(filename);

  /**
   * Which picker to open once the action sheet has finished closing.
   *
   * Launching straight from the row's onPress did nothing at all on iOS: the
   * sheet was still animating away, and the system will not present the camera
   * on top of a view controller that is mid-dismissal. Held in a ref so the
   * Sheet's onDismissed callback always reads the latest choice.
   */
  const pending = useRef<'camera' | 'library' | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Idempotent by construction: the first caller takes the choice and clears
   * it, so the later of onDismissed and the fallback timer does nothing.
   */
  const runPending = () => {
    if (fallback.current) {
      clearTimeout(fallback.current);
      fallback.current = null;
    }
    const source = pending.current;
    pending.current = null;
    if (source) void take(source);
  };

  const cancelPending = () => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    pending.current = null;
    setSheet(false);
  };

  const choose = (source: 'camera' | 'library') => {
    pending.current = source;
    setSheet(false);
    // onDismiss is the intended trigger; this only covers the case where it
    // never arrives, which would leave the tap silently doing nothing again.
    fallback.current = setTimeout(runPending, 600);
  };

  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  const take = async (source: 'camera' | 'library') => {
    if (busy) return;
    setBusy(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? '没有相机权限' : '没有相册权限',
          '到系统设置里打开权限就能加照片了。',
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              exif: false,
            });

      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;

      const stored = await savePhoto(asset.uri);
      // Replacing an existing photo leaves the old file behind otherwise.
      if (filename) deletePhoto(filename);
      onChange(stored);
    } catch (e) {
      Alert.alert('照片没能存下来', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (filename) deletePhoto(filename);
    onChange(null);
  };

  return (
    <View style={styles.wrap}>
      {uri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewActions}>
            <Tap onPress={() => setSheet(true)} style={styles.smallBtn}>
              <Txt size={14} w="semi" c={color.accent700}>
                换一张
              </Txt>
            </Tap>
            <Tap onPress={remove} style={styles.smallBtn}>
              <Txt size={14} w="semi" c={color.accent700}>
                移除
              </Txt>
            </Tap>
          </View>
        </View>
      ) : (
        <Tap onPress={() => setSheet(true)} style={styles.slot}>
          <Txt size={15} w="semi" c={color.accent700}>
            ＋ 加一张照片
          </Txt>
        </Tap>
      )}

      <Sheet
        visible={sheet}
        onClose={cancelPending}
        onDismissed={runPending}
        title="照片来源"
        right={
          <NavAction label="取消" onPress={cancelPending} />
        }
        maxHeightRatio={0.4}
      >
        <View style={styles.sheetBody}>
          <Tap onPress={() => choose('camera')} style={styles.sheetRow}>
            <Txt size={16}>拍照</Txt>
          </Tap>
          <Tap onPress={() => choose('library')} style={styles.sheetRow}>
            <Txt size={16}>从相册选</Txt>
          </Tap>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  slot: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.small,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.neutral300,
    backgroundColor: color.neutral100,
  },
  previewWrap: { gap: 8 },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.small,
    backgroundColor: color.neutral200,
  },
  previewActions: { flexDirection: 'row', gap: 8 },
  smallBtn: {
    minHeight: 38,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.neutral100,
  },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  sheetRow: {
    minHeight: MIN_TAP + 8,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: radius.small,
    backgroundColor: color.neutral100,
  },
});
