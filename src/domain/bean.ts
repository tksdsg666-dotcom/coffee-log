/**
 * Bean naming, subtitles, the attribute table, and swatch colours.
 * Rules from SPEC § 数据模型 › Bean.
 */
import type { Bean } from '@/db/schema';
import { color } from '@/theme';

export const PROCESSES = ['水洗', '日晒', '蜜处理', '厌氧', '拼配'] as const;
export const ROASTS = ['浅烘', '中浅烘', '中烘', '中深烘', '深烘'] as const;
export const DEFAULT_ROAST = '中浅烘';

/**
 * The six preset avatar colours, light to dark. Stored as `token:` references
 * rather than raw hex so a palette retune reaches beans already created.
 *
 * accent300 and accent400 are deliberately absent: they read pink and orange
 * against the rest of the app, which is brown throughout. They stay in
 * TOKEN_COLORS so beans already wearing them keep their colour.
 */
export const SWATCH_TOKENS = [
  'token:accent500',
  'token:accent',
  'token:accent600',
  'token:accent700',
  'token:accent800',
  'token:accent900',
] as const;

const TOKEN_COLORS: Record<string, string> = {
  accent: color.accent,
  // Retired from the picker, kept so existing beans still resolve.
  accent300: color.accent300,
  accent400: color.accent400,
  accent500: color.accent500,
  accent600: color.accent600,
  accent700: color.accent700,
  accent800: color.accent800,
  accent900: color.accent900,
  accent2: color.accent2,
  accent2_500: color.accent2_500,
  accent2_600: color.accent2_600,
  accent2_700: color.accent2_700,
};

/** Resolves a stored swatch — either `token:name` or a literal `#rrggbb`. */
export const swatchColor = (swatch: string): string =>
  swatch.startsWith('token:') ? (TOKEN_COLORS[swatch.slice(6)] ?? color.accent) : swatch;

/**
 * WCAG relative luminance of an #rrggbb colour.
 * Anything above ~0.45 needs dark ink rather than light.
 */
const luminance = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return 0;
  const n = parseInt(m[1], 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
};

/**
 * Ink for the initial sitting on a swatch.
 *
 * Measured rather than listed: the custom hex field lets any colour through,
 * and a hardcoded list of "light" swatches would leave a white letter on a
 * white circle the moment someone types one.
 */
export const inkFor = (swatch: string): string =>
  luminance(swatchColor(swatch)) > 0.45 ? color.accent900 : color.accent100;

/**
 * Accepts `#c67139`, `c67139`, `#c73`, or `rgb(198,113,57)`.
 * Returns a normalised `#rrggbb`, or null when the input is not a colour yet.
 */
export const normalizeHex = (raw: string): string | null => {
  const s = (raw ?? '').trim();
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
  if (rgb) {
    const parts = [rgb[1], rgb[2], rgb[3]].map((x) =>
      Math.max(0, Math.min(255, parseInt(x ?? '0', 10))),
    );
    return `#${parts.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  const body = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(body)) {
    return `#${body
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(body)) return `#${body.toLowerCase()}`;
  return null;
};

type BeanLike = Pick<
  Bean,
  'name' | 'origin' | 'region' | 'farm' | 'variety' | 'process' | 'roast' | 'roaster'
>;

/** SPEC: name if set, else origin + (farm || region), else the placeholder. */
export const beanName = (b: BeanLike): string =>
  b.name || [b.origin, b.farm || b.region].filter(Boolean).join(' ') || '未命名豆子';

/** SPEC: [roaster, farm ? region : '', variety, process, roast] joined with ' · '. */
export const beanSub = (b: BeanLike): string =>
  [b.roaster, b.farm ? b.region : '', b.variety, b.process, b.roast].filter(Boolean).join(' · ');

/** First character of the display name, used inside the round avatar. */
export const beanInitial = (b: BeanLike): string => beanName(b).slice(0, 1);

/** SPEC § 属性表顺序. Empty values are dropped, never shown as placeholders. */
export const beanAttrs = (b: Bean): { k: string; v: string }[] => {
  const rows: [string, string | null][] = [
    ['产地', b.origin],
    ['产区', b.region],
    ['庄园', b.farm],
    ['品种', b.variety],
    ['处理法', b.process],
    ['产季', b.season],
    ['烘焙度', b.roast],
    ['烘焙色值', b.agtron ? `Agtron ${b.agtron}` : null],
    ['烘焙日期', b.roastDate],
    ['烘焙商', b.roaster],
    ['风味', b.flavor],
    ['归属', b.mine ? '我的豆子' : '门店豆子'],
  ];
  return rows.flatMap(([k, v]) => (v ? [{ k, v }] : []));
};

/** SPEC § 创建校验: name / origin / farm — at least one must be filled. */
export const canSaveBean = (d: { name?: string; origin?: string; farm?: string }): boolean =>
  Boolean(d.name?.trim() || d.origin?.trim() || d.farm?.trim());
