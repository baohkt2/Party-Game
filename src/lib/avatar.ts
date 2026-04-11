export const DICEBEAR_STYLES = [
  'pixel-art',
  'adventurer',
  'bottts',
  'lorelei',
  'fun-emoji',
  'croodles',
] as const;

export type DiceBearStyle = (typeof DICEBEAR_STYLES)[number];
export type DiceBearFormat = 'svg' | 'png';

const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x';
const avatarUrlCache = new Map<string, string>();

function sanitizeSeed(seed: string): string {
  const safeSeed = seed.trim();
  return safeSeed.length > 0 ? safeSeed : 'player';
}

function isDiceBearStyle(style: string): style is DiceBearStyle {
  return DICEBEAR_STYLES.includes(style as DiceBearStyle);
}

function normalizeStyle(style?: string): DiceBearStyle {
  if (style && isDiceBearStyle(style)) return style;
  return 'pixel-art';
}

function normalizeFormat(format?: string): DiceBearFormat {
  return format === 'png' ? 'png' : 'svg';
}

export function getDiceBearAvatarUrl({
  style,
  format,
  seed,
  size,
}: {
  style?: string;
  format?: string;
  seed: string;
  size?: number;
}): string {
  const normalizedStyle = normalizeStyle(style);
  const normalizedFormat = normalizeFormat(format);
  const normalizedSeed = sanitizeSeed(seed);
  const cacheKey = `${normalizedStyle}|${normalizedFormat}|${normalizedSeed}|${size ?? ''}`;

  const cached = avatarUrlCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ seed: normalizedSeed });
  if (size && Number.isFinite(size) && size > 0) {
    params.set('size', String(Math.floor(size)));
  }

  const url = `${DICEBEAR_BASE_URL}/${normalizedStyle}/${normalizedFormat}?${params.toString()}`;
  avatarUrlCache.set(cacheKey, url);
  return url;
}

export function normalizeAvatarUrl(avatar: unknown, fallbackSeed: string): string {
  if (typeof avatar === 'string' && avatar.length > 0) {
    try {
      const parsed = new URL(avatar);
      if (parsed.protocol === 'https:' && parsed.hostname === 'api.dicebear.com' && parsed.pathname.startsWith('/9.x/')) {
        return parsed.toString();
      }
    } catch {
      // Ignore invalid URL and fallback to generated one.
    }
  }

  return getDiceBearAvatarUrl({
    style: 'pixel-art',
    format: 'svg',
    seed: fallbackSeed,
  });
}

export function createRandomAvatarSeed(prefix = 'player'): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomPart}`;
}