/**
 * WhatsApp Auto Publisher Engine
 * مسؤول عن:
 * - النشر التلقائي في قروبات الحساب
 * - دعم (نص / صورة / فيديو)
 * - تشغيل / إيقاف فوري لكل حساب
 * - حلقة نشر مستمرة مع تأخير ذكي
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// حالة النشر لكل حساب
// { accId: true/false }
const publishingState = {};

// تأخير افتراضي (مللي ثانية)
const DEFAULT_DELAY = 3000;

/**
 * مسار ملف الإعلان للحساب
 */
function getAdFile(accountId) {
  return path.join(
    __dirname,
    `../storage/accounts/data/${accountId}/ads/current.json`
  );
}

/**
 * تحميل الإعلان الحالي
 */
function loadAd(accountId) {
  const file = getAdFile(accountId);
  if (!fs.existsSync(file)) {
    return { type: null, content: null, caption: '' };
  }

  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (err) {
    logger.error(
      `❌ فشل قراءة ملف الإعلان للحساب ${accountId}`,
      err
    );
    return { type: null, content: null, caption: '' };
  }
}

/**
 * تشغيل النشر للحساب
 */
function startPublishing(accountId) {
  publishingState[accountId] = true;
  logger.info(`📢 تم تشغيل النشر التلقائي للحساب ${accountId}`);
}

/**
 * إيقاف النشر للحساب
 */
function stopPublishing(accountId) {
  publishingState[accountId] = false;
  logger.info(`⛔ تم إيقاف النشر التلقائي للحساب ${accountId}`);
}

/**
 * هل النشر مفعّل؟
 */
function isPublishing(accountId) {
  return publishingState[accountId] === true;
}

/**
 * جلب جميع قروبات الحساب
 */
async function getAllGroups(sock) {
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.keys(groups || {});
  } catch (err) {
    logger.error('❌ فشل جلب القروبات', err);
    return [];
  }
}

/**
 * تأخير ذكي
 */
function delay(ms = DEFAULT_DELAY) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * محرك النشر التلقائي
 * @param {object} sock - WASocket
 * @param {string} accountId
 */
async function publishLoop(sock, accountId) {
  if (!sock) return;

  startPublishing(accountId);

  while (isPublishing(accountId)) {
    try {
      const ad = loadAd(accountId);

      if (!ad.type || !ad.content) {
        logger.warn(
          `⚠️ لا يوجد إعلان صالح للحساب ${accountId}`
        );
        await delay(5000);
        continue;
      }

      const groups = await getAllGroups(sock);

      if (!groups.length) {
        logger.warn(
          `⚠️ لا توجد قروبات للنشر للحساب ${accountId}`
        );
        await delay(5000);
        continue;
      }

      logger.info(
        `📤 بدء دورة نشر (${groups.length} قروب) للحساب ${accountId}`
      );

      for (const groupId of groups) {
        if (!isPublishing(accountId)) break;

        try {
          // =========================
          // نشر نص
          // =========================
          if (ad.type === 'text') {
            await sock.sendMessage(groupId, {
              text: ad.content
            });
          }

          // =========================
          // نشر صورة
          // =========================
          if (ad.type === 'image') {
            await sock.sendMessage(groupId, {
              image: { url: ad.content },
              caption: ad.caption || ''
            });
          }

          // =========================
          // نشر فيديو
          // =========================
          if (ad.type === 'video') {
            await sock.sendMessage(groupId, {
              video: { url: ad.content },
              caption: ad.caption || ''
            });
          }

          logger.info(
            `✅ [${accountId}] تم النشر في ${groupId}`
          );

          await delay(DEFAULT_DELAY);
        } catch (err) {
          logger.warn(
            `⚠️ فشل النشر في ${groupId} للحساب ${accountId}`,
            err.message
          );
          await delay(DEFAULT_DELAY);
        }
      }

      // بعد الانتهاء من دورة كاملة
      await delay(5000);

    } catch (err) {
      logger.error(
        `❌ خطأ عام في محرك النشر للحساب ${accountId}`,
        err
      );
      await delay(5000);
    }
  }

  logger.info(`⛔ تم إيقاف حلقة النشر للحساب ${accountId}`);
}

module.exports = {
  startPublishing,
  stopPublishing,
  isPublishing,
  publishLoop
};
