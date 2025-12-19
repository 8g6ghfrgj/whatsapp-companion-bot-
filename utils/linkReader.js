/**
 * Link Reader Utility
 * قراءة الروابط المجمعة لكل حساب
 */

const fs = require('fs');
const path = require('path');

/**
 * أنواع الروابط المدعومة
 */
const LINK_TYPES = [
  'whatsapp',
  'telegram',
  'twitter',
  'instagram',
  'tiktok',
  'others'
];

/**
 * مسار مجلد الروابط لحساب معيّن
 */
function getLinksDir(accountId) {
  return path.join(
    __dirname,
    `../storage/accounts/data/${accountId}/links`
  );
}

/**
 * قراءة روابط نوع معيّن
 */
function readLinksByType(accountId, type) {
  const filePath = path.join(
    getLinksDir(accountId),
    `${type}.json`
  );

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath));
    return Array.isArray(data.links) ? data.links : [];
  } catch {
    return [];
  }
}

/**
 * قراءة جميع الروابط مصنفة
 */
function readAllLinks(accountId) {
  const result = {};

  for (const type of LINK_TYPES) {
    result[type] = readLinksByType(accountId, type);
  }

  return result;
}

/**
 * حساب عدد الروابط الكلي
 */
function countAllLinks(accountId) {
  const all = readAllLinks(accountId);
  let total = 0;

  for (const type of LINK_TYPES) {
    total += all[type].length;
  }

  return total;
}

module.exports = {
  LINK_TYPES,
  readLinksByType,
  readAllLinks,
  countAllLinks
};
