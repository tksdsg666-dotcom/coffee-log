/**
 * Bottom sheet. Used by 选豆子 / 选时间 / 照片来源 / 新建品牌.
 *
 * Built on RN's Modal rather than a gesture library: these sheets are all
 * dismissed by an explicit control (取消 / 完成 / backdrop tap), never by a
 * drag, so a pan responder would add weight without adding behaviour.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, radius, shadowLg } from '@/theme';
import { Txt } from './ui';

export function Sheet({
  visible,
  onClose,
  title,
  left,
  right,
  children,
  /**
   * Fires once the sheet is fully off screen. Anything that presents its own
   * native screen — the camera, the photo library, a document picker — has to
   * wait for this: iOS silently ignores a presentation request aimed at a view
   * controller that is still animating away.
   */
  onDismissed,
  /** Caps the body height so a long list scrolls inside the sheet. */
  maxHeightRatio = 0.86,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  onDismissed?: () => void;
  maxHeightRatio?: number;
}) {
  const insets = useSafeAreaInsets();

  /**
   * With the keyboard up the sheet no longer sits against the screen edge, so
   * two things have to change: the home-indicator inset is dead space (the
   * keyboard already covers that strip), and the square bottom corners meet the
   * keyboard as a hard seam. Rounding them turns the panel into a card that
   * reads as finished rather than cut off.
   */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardUp(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Modal's onDismiss is iOS-only, so Android gets the same signal from the
  // visible → hidden transition instead.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onDismissed?.();
    wasVisible.current = visible;
  }, [visible, onDismissed]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? onDismissed : undefined}
      statusBarTranslucent
    >
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        {/*
          Sheets sit against the bottom edge, so a keyboard covers them
          entirely. Lifting the sheet itself is the only fix that works inside
          a Modal — a ScrollView's keyboard insets do not reach up here.
        */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.lift}
        >
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: keyboardUp ? 14 : Math.max(insets.bottom, 12),
              maxHeight: `${maxHeightRatio * 100}%`,
            },
            keyboardUp && styles.sheetLifted,
          ]}
        >
          <View style={styles.grabber} />
          {title || left || right ? (
            <View style={styles.header}>
              <View style={styles.side}>{left}</View>
              <Txt size={17} w="semi" numberOfLines={1} style={styles.title}>
                {title}
              </Txt>
              <View style={[styles.side, styles.sideRight]}>{right}</View>
            </View>
          ) : null}
          {children}
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // The lift must carry the full height, not wrap its content: the sheet's
  // maxHeight is a percentage, and a percentage against an auto-height parent
  // collapses the panel to its header while the children spill out below it.
  lift: { flex: 1, justifyContent: 'flex-end' },
  // Written out rather than spreading StyleSheet.absoluteFill: that constant is
  // a registered style id in some RN versions and a plain object in others, so
  // spreading it only type-checks on half of them.
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(46, 43, 37, 0.42)',
  },
  sheet: {
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 8,
    ...shadowLg,
  },
  sheetLifted: {
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: color.neutral300,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 10,
  },
  side: { minWidth: 72, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
