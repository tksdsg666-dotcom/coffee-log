/**
 * Route helpers — the one place that knows how each path is spelled.
 *
 * expo-router's `experiments.typedRoutes` is deliberately off (app.json). Its
 * generator leaks files from outside `app/` into the route union on Windows:
 * `getWatchHandler` decides whether a changed file is inside the app directory
 * with `path.relative(APP_ROOT, file).startsWith('../')`, and on Windows
 * `path.relative` returns `..\src\...` — backslashes, so the guard never fires.
 * Editing anything under src/ with the dev server running can therefore produce
 * a union that rejects correct navigation calls, which is worse than no
 * checking at all. Re-enable it by restoring `experiments.typedRoutes` if a
 * future SDK fixes this.
 *
 * Six routes do not need a code generator. A typo here is still a compile
 * error, and every dynamic route has exactly one definition of its parameter.
 */
import type { Href } from 'expo-router';

export const routes = {
  timeline: '/',
  beans: '/beans',
  me: '/me',
  stats: '/stats',

  /** 记一杯, blank. */
  newRecord: '/record/edit',

  /** 记一杯 prefilled from an existing record. */
  editRecord: (id: string) => ({ pathname: '/record/edit', params: { id } }),

  recordDetail: (id: string) => ({ pathname: '/record/[id]', params: { id } }),

  beanDetail: (id: string) => ({ pathname: '/bean/[id]', params: { id } }),
} satisfies Record<string, Href | ((id: string) => Href)>;
