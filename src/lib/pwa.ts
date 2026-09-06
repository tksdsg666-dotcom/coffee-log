/**
 * Web-only startup: install the service worker, ask for durable storage.
 * A no-op on native, where the app is already installed and the sandbox is
 * already durable.
 */
export const setupPwa = (): void => {};

/** Native is installed by definition; nothing to prompt for. */
export const isStandalone = (): boolean => true;
