import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

/**
 * 咖啡记录 App — 数据层
 *
 * 设计原则：
 * 1. 只有两张表。豆子单独拆出来，是因为"这包豆子调到什么参数最好喝"是这个 App 的核心价值。
 * 2. 在家 / 在外 用同一张 logs 表，靠 place 区分（null = 在家）。
 * 3. 参数用六个可空数字列覆盖三种做法，不用 JSON、不用分表。
 * 4. 所有比例（粉水比、萃取比）都是算出来的，不存。存了迟早会和原始数据对不上。
 */

// ─────────────────────────────────────────────
// 豆子：只有在家冲煮才需要
// ─────────────────────────────────────────────
export const beans = sqliteTable(
  'beans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    name: text('name').notNull(),              // 「耶加雪菲 阿多多」
    roaster: text('roaster'),                  // 烘焙商 / 品牌
    origin: text('origin'),                    // 产地
    process: text('process'),                  // 日晒 / 水洗 / 厌氧…… 自由填，别做成枚举
    roastLevel: text('roast_level'),           // 浅 / 中浅 / 中 / 中深 / 深

    roastedOn: integer('roasted_on', { mode: 'timestamp' }),  // 烘焙日 → 用来算养豆天数
    openedOn: integer('opened_on', { mode: 'timestamp' }),    // 开封日 → 用来判断赏味期

    weightG: integer('weight_g'),              // 整包克数
    priceCny: real('price_cny'),               // 用来算「每杯成本」

    isFinished: integer('is_finished', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    // 「加记录」页面要按「未喝完」筛豆子，这是最高频的查询
    finishedIdx: index('beans_finished_idx').on(t.isFinished),
  })
);

// ─────────────────────────────────────────────
// 每一杯咖啡
// ─────────────────────────────────────────────
export const logs = sqliteTable(
  'logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    drankAt: integer('drank_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),

    // 'espresso' | 'pourover' | 'coldbrew' | 'other'
    // 在家和在外共用这套词汇 —— 这是整个 schema 能简化成一张表的关键
    method: text('method').notNull(),

    // null = 在家自己做的；有值 = 店名（Manner / M Stand / Grid / 某某精品店）
    // 不建 shops 表，输入时从历史记录做 autocomplete 就够了
    place: text('place'),

    // ── 在家：关联豆子 ───────────────────────
    beanId: integer('bean_id').references(() => beans.id, { onDelete: 'set null' }),

    // ── 在外：喝的是什么 ─────────────────────
    drinkName: text('drink_name'),             // 「燕麦拿铁」「今日手冲」
    priceCny: real('price_cny'),

    // ── 参数：六个列覆盖三种做法 ──────────────
    // 意式   → doseG, yieldG, timeS, grind
    // 手冲   → doseG, waterG, tempC, timeS, grind
    // 冷萃   → doseG, waterG, timeS（秒，16 小时 = 57600）, grind
    // 在外喝 → 全空，或只记得什么填什么
    doseG: real('dose_g'),                     // 粉量
    yieldG: real('yield_g'),                   // 液重（意式）
    waterG: real('water_g'),                   // 水量（手冲 / 冷萃）
    tempC: integer('temp_c'),                  // 水温
    timeS: integer('time_s'),                  // 时长（秒）
    grind: text('grind'),                      // 研磨度：存文本，因为「C40 22格」和「1Zpresso 3.2圈」没法统一成数字

    // ── 评价：一个分数 + 一句话，就够了 ────────
    rating: integer('rating'),                 // 1–5
    note: text('note'),                        // 「有点酸，下次磨细一点」
    photoUri: text('photo_uri'),               // expo-file-system 的本地路径

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    // 首页时间线
    drankAtIdx: index('logs_drank_at_idx').on(t.drankAt),
    // 豆子详情页：看这包豆子的参数演进
    beanIdx: index('logs_bean_idx').on(t.beanId, t.drankAt),
    // 「我在 Manner 喝过多少杯」/「手冲平均分」
    placeIdx: index('logs_place_idx').on(t.place),
    methodIdx: index('logs_method_idx').on(t.method),
  })
);

// ─────────────────────────────────────────────
// 关系
// ─────────────────────────────────────────────
export const beansRelations = relations(beans, ({ many }) => ({
  logs: many(logs),
}));

export const logsRelations = relations(logs, ({ one }) => ({
  bean: one(beans, {
    fields: [logs.beanId],
    references: [beans.id],
  }),
}));

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────
export type Bean = typeof beans.$inferSelect;
export type NewBean = typeof beans.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;

export const METHODS = ['espresso', 'pourover', 'coldbrew', 'other'] as const;
export type Method = (typeof METHODS)[number];

export const METHOD_LABELS: Record<Method, string> = {
  espresso: '意式',
  pourover: '手冲',
  coldbrew: '冷萃',
  other: '其他',
};

// ─────────────────────────────────────────────
// 派生值：算出来，不存
// ─────────────────────────────────────────────

/** 意式萃取比 1:2.0 ／ 手冲粉水比 1:15 */
export function ratio(log: Pick<Log, 'method' | 'doseG' | 'yieldG' | 'waterG'>): number | null {
  const out = log.method === 'espresso' ? log.yieldG : log.waterG;
  if (!log.doseG || !out) return null;
  return out / log.doseG;
}

/** 养豆天数 */
export function daysOffRoast(bean: Pick<Bean, 'roastedOn'>, at: Date = new Date()): number | null {
  if (!bean.roastedOn) return null;
  return Math.floor((at.getTime() - bean.roastedOn.getTime()) / 86_400_000);
}

/** 是否在家 */
export function isHome(log: Pick<Log, 'place'>): boolean {
  return log.place === null || log.place === '';
}
