/**
 * Drizzle schema. Mirrors the data model in docs/design/SPEC.md.
 *
 * The governing rule from SPEC: every parameter column is nullable and an
 * absent value is never written. Nothing derived is stored — ratios, counts and
 * averages are all computed at read time.
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Where a cup came from. The row with id 'self' is reserved and undeletable. */
export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** 1 on the reserved 'self' row only. */
  isSelf: integer('is_self', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const beans = sqliteTable('beans', {
  id: text('id').primaryKey(),
  name: text('name'),
  origin: text('origin'),
  region: text('region'),
  farm: text('farm'),
  variety: text('variety'),
  /** Five presets plus free text — SPEC § 已确认的产品决策 7. */
  process: text('process'),
  roast: text('roast').notNull(),
  season: text('season'),
  agtron: text('agtron'),
  roastDate: text('roast_date'),
  roaster: text('roaster'),
  flavor: text('flavor'),
  /** true = 我的豆子, false = 门店豆子 */
  mine: integer('mine', { mode: 'boolean' }).notNull().default(true),
  /** Avatar colour: a hex string, or a `token:accent600` reference into the palette. */
  swatch: text('swatch').notNull(),
  createdAt: integer('created_at').notNull(),
});

/**
 * Brew gear and grinders. SPEC: "设备表是单一数据源，记一杯的器具和磨豆机选项
 * 从它实时过滤" — so `isBrew` / `isGrinder` are stored, derived from `kind` at
 * write time, and the record form filters on them.
 */
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  isBrew: integer('is_brew', { mode: 'boolean' }).notNull().default(false),
  isGrinder: integer('is_grinder', { mode: 'boolean' }).notNull().default(false),
  /** Grinder dial spec. Null on brew gear and scales. */
  gstep: real('gstep'),
  gmin: real('gmin'),
  gmax: real('gmax'),
  gdef: real('gdef'),
  gunit: text('gunit'),
  createdAt: integer('created_at').notNull(),
});

export const records = sqliteTable(
  'records',
  {
    id: text('id').primaryKey(),

    /**
     * Wall-clock time of the cup, kept as separate parts rather than an
     * instant: the timeline groups by calendar day and the wheel picker edits
     * day/hour/minute independently, so a timezone-shifting epoch would be the
     * wrong primitive. `drankAtMs` exists purely as a sort key.
     */
    year: integer('year').notNull(),
    mon: integer('mon').notNull(),
    day: integer('day').notNull(),
    /** "HH:MM" */
    time: text('time').notNull(),
    drankAtMs: integer('drank_at_ms').notNull(),

    /** One of METHODS in src/domain/methods.ts. */
    method: text('method').notNull(),
    /**
     * What a 特调 is built on: 浓缩 / 冷萃 / 滴滤. Null on every other method.
     * The base decides which extraction parameters the record carries, because
     * the same drink is espresso-based in one shop and cold-brew in the next.
     */
    base: text('base'),
    /**
     * A name the user typed for a 其他 cup — 虹吸, 摩卡壶, 气泡冷萃, anything the
     * six methods do not cover. Null everywhere else; the timeline shows it in
     * place of the generic 其他 label.
     */
    methodName: text('method_name'),
    /** brands.id — 'self' means 自制. */
    brandId: text('brand_id').notNull(),
    /** beans.id, nullable: a cup can be logged without naming a bean. */
    beanId: text('bean_id'),
    /** true = 冰. Null is not "hot" — it is "not recorded". */
    ice: integer('ice', { mode: 'boolean' }),
    /** 1-5 whole stars, no halves — SPEC § 已确认的产品决策 3. */
    rating: integer('rating'),
    note: text('note').notNull().default(''),
    /** Filename inside the app's photo directory. */
    photo: text('photo'),

    /** Only written when method='滴滤' and brandId='self'. */
    gear: text('gear'),
    grinder: text('grinder'),
    /**
     * The grinder's unit, denormalised onto the record so history keeps
     * displaying in its own unit after the grinder is edited or deleted.
     */
    gunit: text('gunit'),

    dose: real('dose'),
    water: real('water'),
    yieldG: real('yield_g'),
    milk: real('milk'),
    grind: real('grind'),
    tempC: integer('temp_c'),
    sec: integer('sec'),
    hours: integer('hours'),
    /** Brew pressure in bar. Espresso-based methods only. */
    pressure: real('pressure'),

    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('records_drank_at_idx').on(sql`${t.drankAtMs} DESC`),
    index('records_bean_idx').on(t.beanId),
    index('records_brand_idx').on(t.brandId),
  ],
);

/**
 * Key-value preferences. A table rather than device storage so it travels with
 * the JSON backup — a restore that lost your defaults would be a restore that
 * felt wrong on first use.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Bean = typeof beans.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type CoffeeRecord = typeof records.$inferSelect;

export type NewBrand = typeof brands.$inferInsert;
export type NewBean = typeof beans.$inferInsert;
export type NewDevice = typeof devices.$inferInsert;
export type NewRecord = typeof records.$inferInsert;
