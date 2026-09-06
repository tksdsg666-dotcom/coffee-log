/**
 * Web-only startup.
 *
 * Two things, both silent. Neither is allowed to fail loudly: the app works
 * without a service worker (just not offline) and without a persistence grant
 * (just not guaranteed), and a thrown error here would take the whole boot down
 * for a benefit the user did not ask for.
 */

/**
 * Without this the browser may evict the database under storage pressure.
 *
 * The answer is not ours to decide: Chrome grants it on its own engagement
 * heuristics, and Safari grants it once the site has been added to the home
 * screen — which is exactly how this app is meant to be used, and why the 我的
 * screen still tells people to install it rather than living in a tab.
 */
const requestDurableStorage = (): void => {
  void navigator.storage?.persist?.().catch(() => undefined);
};

const registerWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  };
  // After load, so registering never competes with the first paint — unless
  // load has already happened, in which case the event will never fire again.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
};

/**
 * Whether the app is running from the home screen rather than in a tab.
 *
 * Read once at module load: it cannot change without a fresh document, and
 * re-reading it per render would make the install hint flicker.
 */
const STANDALONE =
  typeof window !== 'undefined' &&
  ((navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches);

export const isStandalone = (): boolean => STANDALONE;

export const setupPwa = (): void => {
  if (typeof window === 'undefined') return;
  registerWorker();
  requestDurableStorage();
};
