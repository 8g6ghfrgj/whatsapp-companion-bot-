/**
 * أنماط الروابط حسب المنصة
 */
const LINK_PATTERNS = {
  whatsapp: /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/gi,
  telegram: /https?:\/\/t\.me\/[A-Za-z0-9_\/]+/gi,
  instagram: /https?:\/\/(www\.)?instagram\.com\/[^\s]+/gi,
  youtube: /https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/gi,
  twitter: /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s]+/gi,
  facebook: /https?:\/\/(www\.)?facebook\.com\/[^\s]+/gi,
  tiktok: /https?:\/\/(www\.)?tiktok\.com\/[^\s]+/gi,
  website: /https?:\/\/[^\s]+/gi
};

/**
 * استخراج الروابط من نص
 */
export function extractLinks(text) {
  if (!text || typeof text !== 'string') return [];

  const foundLinks = new Set();

  for (const pattern of Object.values(LINK_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((link) => foundLinks.add(link));
    }
  }

  return Array.from(foundLinks);
}

/**
 * تصنيف رابط واحد
 */
export function classifyLink(url) {
  if (!url) return 'unknown';

  if (url.match(LINK_PATTERNS.whatsapp)) return 'whatsapp';
  if (url.match(LINK_PATTERNS.telegram)) return 'telegram';
  if (url.match(LINK_PATTERNS.instagram)) return 'instagram';
  if (url.match(LINK_PATTERNS.youtube)) return 'youtube';
  if (url.match(LINK_PATTERNS.twitter)) return 'twitter';
  if (url.match(LINK_PATTERNS.facebook)) return 'facebook';
  if (url.match(LINK_PATTERNS.tiktok)) return 'tiktok';

  return 'website';
}

/**
 * استخراج وتصنيف الروابط دفعة واحدة
 */
export function parseLinks(text) {
  const links = extractLinks(text);

  return links.map((url) => ({
    url,
    type: classifyLink(url)
  }));
}
