/**
 * Confirmations and messages.
 *
 * On native this is React Native's `Alert`, unchanged — it is what the app has
 * always used and what iOS users expect. On web `Alert.alert` is a **no-op**
 * (react-native-web ships `static alert() {}`), which would make every delete
 * confirmation and every error message silently do nothing, so the web build
 * substitutes its own dialog through `alert.web.ts`.
 *
 * The store exports below exist only for that web dialog. Natively nothing is
 * ever pushed, `AlertHost` renders null, and the system dialog does the work.
 */
import { Alert } from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

export const showAlert = (title: string, message?: string, buttons?: AlertButton[]): void => {
  Alert.alert(title, message, buttons);
};

export const subscribeAlerts = (_listener: () => void): (() => void) => () => {};

export const currentAlert = (): AlertRequest | null => null;

export const dismissAlert = (): void => {};
