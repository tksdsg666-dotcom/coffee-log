/**
 * Tests for the service worker's routing. Run with `npm test`.
 *
 * The worker is the one piece of this app that can break the app for good: a
 * wrong rule can pin every visitor to a stale bundle with no way to reach the
 * new one, and it runs in a context this project has no way to open on this
 * machine. So it is evaluated here in a sandbox with the browser APIs it
 * touches faked, and its three decisions — navigate, immutable, everything
 * else — are exercised directly.
 *
 * `public/sw.js` is plain JS on purpose: it ships to the browser as-is, and a
 * build step between what is tested and what is served would defeat the point.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const ORIGIN = 'https://coffee.thinker.win';
// A path rather than a file:// URL: `lib` includes DOM, so `URL` here is the
// DOM one and `readFileSync` will not take it.
const SOURCE = readFileSync(join(import.meta.dirname, '..', '..', 'public', 'sw.js'), 'utf8');

type FakeResponse = { ok: boolean; body: string; clone: () => FakeResponse };

const response = (body: string, ok = true): FakeResponse => {
  const self: FakeResponse = { ok, body, clone: () => self };
  return self;
};

type FakeRequest = {
  url: string;
  method: string;
  mode: string;
  headers: { has: (name: string) => boolean };
};

const request = (
  path: string,
  { mode = 'no-cors', method = 'GET', range = false } = {},
): FakeRequest => ({
  url: new URL(path, ORIGIN).href,
  method,
  mode,
  headers: { has: (name: string) => name === 'range' && range },
});

const keyOf = (req: FakeRequest | string) =>
  typeof req === 'string' ? new URL(req, ORIGIN).href : req.url;

/** Boots the worker and returns handles onto everything it can reach. */
const bootWorker = (fetchImpl: (req: FakeRequest | string) => Promise<FakeResponse>) => {
  const fetches: string[] = [];
  const fetchCounted = (req: FakeRequest | string) => {
    fetches.push(keyOf(req));
    return fetchImpl(req);
  };

  const stores = new Map<string, Map<string, FakeResponse>>();
  const cacheFor = (name: string) => {
    const entries = stores.get(name) ?? new Map<string, FakeResponse>();
    stores.set(name, entries);
    return {
      match: async (req: FakeRequest | string) => entries.get(keyOf(req)),
      put: async (req: FakeRequest | string, res: FakeResponse) => {
        entries.set(keyOf(req), res);
      },
      add: async (req: FakeRequest | string) => {
        entries.set(keyOf(req), await fetchCounted(req));
      },
    };
  };

  const handlers = new Map<string, (event: unknown) => void>();
  const claimed = { skipWaiting: false, claim: false };

  const context = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn),
      skipWaiting: () => {
        claimed.skipWaiting = true;
      },
      clients: {
        claim: async () => {
          claimed.claim = true;
        },
      },
    },
    caches: {
      open: async (name: string) => cacheFor(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
    fetch: fetchCounted,
    URL,
    Promise,
    console,
  };

  runInNewContext(SOURCE, context);

  /** Runs the fetch handler and returns what it answered with, or null. */
  const handleFetch = async (req: FakeRequest): Promise<FakeResponse | null> => {
    let answer: Promise<FakeResponse> | null = null;
    handlers.get('fetch')?.({ request: req, respondWith: (p: Promise<FakeResponse>) => (answer = p) });
    return answer === null ? null : await (answer as Promise<FakeResponse>);
  };

  const runLifecycle = async (type: 'install' | 'activate') => {
    let waited: Promise<unknown> | null = null;
    handlers.get(type)?.({ waitUntil: (p: Promise<unknown>) => (waited = p) });
    if (waited) await waited;
  };

  return { handleFetch, runLifecycle, fetches, stores, claimed };
};

const online = async (req: FakeRequest | string) => response(`body of ${keyOf(req)}`);
const offline = async () => {
  throw new Error('offline');
};

test('install caches the shell and takes over immediately', async () => {
  const w = bootWorker(online);
  await w.runLifecycle('install');

  assert.equal(w.claimed.skipWaiting, true);
  const cache = [...w.stores.values()][0];
  assert.ok(cache?.has(`${ORIGIN}/index.html`));
});

test('a failed shell fetch still lets the worker install', async () => {
  const w = bootWorker(offline);
  await w.runLifecycle('install');
  assert.equal(w.claimed.skipWaiting, true);
});

test('activate drops caches from older versions and claims open pages', async () => {
  const w = bootWorker(online);
  await w.runLifecycle('install');
  w.stores.set('coffee-log-v0', new Map());

  await w.runLifecycle('activate');

  assert.deepEqual([...w.stores.keys()], ['coffee-log-v1']);
  assert.equal(w.claimed.claim, true);
});

test('a navigation goes to the network and refreshes the cached shell', async () => {
  const w = bootWorker(online);
  const res = await w.handleFetch(request('/record/edit', { mode: 'navigate' }));

  assert.equal(res?.body, `body of ${ORIGIN}/record/edit`);
  // Stored under the shell key, not the route: every route is this document,
  // which is what keeps a deep link working on the next launch.
  const cache = [...w.stores.values()][0];
  assert.ok(cache?.has(`${ORIGIN}/index.html`));
  assert.equal(cache?.has(`${ORIGIN}/record/edit`), false);
});

test('offline, a navigation to any route falls back to the cached shell', async () => {
  let up = true;
  const w = bootWorker(async (req) => {
    if (!up) throw new Error('offline');
    return response(`body of ${keyOf(req)}`);
  });

  await w.handleFetch(request('/', { mode: 'navigate' }));
  up = false;
  const res = await w.handleFetch(request('/bean/b_123', { mode: 'navigate' }));

  assert.equal(res?.body, `body of ${ORIGIN}/`);
});

test('a hashed asset is fetched once and served from cache after that', async () => {
  const w = bootWorker(online);
  const path = '/_expo/static/js/web/entry-abc123.js';

  const first = await w.handleFetch(request(path));
  const second = await w.handleFetch(request(path));

  assert.equal(first?.body, second?.body);
  assert.deepEqual(w.fetches, [`${ORIGIN}${path}`]);
});

test('a failed response is not cached', async () => {
  const w = bootWorker(async () => response('not found', false));
  const path = '/_expo/static/js/web/missing.js';

  await w.handleFetch(request(path));
  await w.handleFetch(request(path));

  assert.equal(w.fetches.length, 2);
});

test('writes, other origins and range requests are left alone', async () => {
  const w = bootWorker(online);

  assert.equal(await w.handleFetch(request('/anything', { method: 'POST' })), null);
  assert.equal(await w.handleFetch(request('https://fonts.example/x.woff2')), null);
  assert.equal(await w.handleFetch(request('/photo.mp4', { range: true })), null);
  assert.deepEqual(w.fetches, []);
});
