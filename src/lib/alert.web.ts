/**
 * The web half of `alert.ts`: an in-app dialog instead of the system one.
 *
 * `window.confirm` would have been shorter, but a standalone PWA renders it as
 * "coffee.thinker.win 说…" over the app, and it cannot express a destructive
 * button. This keeps an imperative call site (`showAlert(...)`) and hands the
 * actual rendering to `AlertHost`, mounted once at the root.
 *
 * Requests queue rather than replace: a failed save can raise two in a row and
 * dropping the first would hide the reason.
 */
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

const DISMISS: AlertButton[] = [{ text: '好', style: 'default' }];

let queue: AlertRequest[] = [];
const listeners = new Set<() => void>();

const emit = () => {
  for (const fn of listeners) fn();
};

export const showAlert = (title: string, message?: string, buttons?: AlertButton[]): void => {
  queue = [...queue, { title, message, buttons: buttons?.length ? buttons : DISMISS }];
  emit();
};

export const subscribeAlerts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Identity matters: `useSyncExternalStore` re-reads this on every render and
 * compares by reference, so it has to return the same object until the queue
 * actually changes.
 */
export const currentAlert = (): AlertRequest | null => queue[0] ?? null;

export const dismissAlert = (): void => {
  queue = queue.slice(1);
  emit();
};
