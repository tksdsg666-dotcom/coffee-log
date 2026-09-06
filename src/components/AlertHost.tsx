/**
 * The dialog behind `showAlert`, mounted once at the root.
 *
 * Renders nothing on native — there `showAlert` goes straight to the system
 * dialog and the store is never written to. This exists for the web build,
 * where `Alert.alert` does nothing at all.
 */
import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { currentAlert, dismissAlert, subscribeAlerts, type AlertButton } from '@/lib/alert';
import { color, MIN_TAP, radius, shadowLg } from '@/theme';
import { Txt } from './ui';

const inkFor = (style: AlertButton['style']) =>
  style === 'destructive' ? color.danger : style === 'cancel' ? color.neutral700 : color.accent700;

export function AlertHost() {
  const request = useSyncExternalStore(subscribeAlerts, currentAlert, currentAlert);
  if (!request) return null;

  const run = (button: AlertButton) => {
    dismissAlert();
    button.onPress?.();
  };

  /** Backdrop and Escape cancel only when cancelling is one of the choices. */
  const cancel = request.buttons.find((b) => b.style === 'cancel');
  const escape = () => {
    dismissAlert();
    cancel?.onPress?.();
  };

  // Two buttons sit side by side; three or more stack, because a row of three
  // truncates the labels this app uses (删除 / 取消 / 先导出).
  const stacked = request.buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={escape}>
      <Pressable style={styles.backdrop} onPress={cancel ? escape : undefined}>
        {/* Swallows taps so pressing the card itself never dismisses it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Txt size={17} w="bold" style={styles.center}>
            {request.title}
          </Txt>
          {request.message ? (
            <Txt size={14} c={color.neutral700} style={[styles.center, styles.message]}>
              {request.message}
            </Txt>
          ) : null}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {request.buttons.map((button, i) => (
              <Pressable
                key={`${button.text}-${i}`}
                onPress={() => run(button)}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <Txt size={16} w={button.style === 'cancel' ? 'regular' : 'semi'} c={inkFor(button.style)}>
                  {button.text}
                </Txt>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    gap: 8,
    padding: 20,
    paddingBottom: 8,
    borderRadius: radius.card,
    backgroundColor: color.neutral100,
    ...shadowLg,
  },
  center: { textAlign: 'center' },
  message: { lineHeight: 20 },
  buttons: { flexDirection: 'row', marginTop: 6 },
  buttonsStacked: { flexDirection: 'column-reverse' },
  button: {
    flex: 1,
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.small,
  },
  buttonPressed: { backgroundColor: color.neutral200 },
});
