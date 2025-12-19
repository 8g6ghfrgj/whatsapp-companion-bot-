/**
 * WhatsApp Events Listener
 * مسؤول عن التقاط الرسائل وتمريرها للمحركات
 */

const logger = require('../utils/logger');

// Engines
const {
  extractLinks,
  saveLinks,
  isScrapingEnabled
} = require('./scraper');

const { handleAutoReplies } = require('./replies');

/**
 * تسجيل أحداث واتساب لحساب معيّن
 * @param {object} sock - WASocket
 * @param {string} accountId
 */
function registerWhatsAppEvents(sock, accountId) {
  if (!sock) {
    logger.error(`❌ Socket غير صالح للحساب ${accountId}`);
    return;
  }

  logger.info(`📡 تفعيل مراقبة الرسائل للحساب ${accountId}`);

  sock.ev.on('messages.upsert', async (event) => {
    try {
      if (!event.messages || event.type !== 'notify') return;

      for (const msg of event.messages) {
        if (!msg.message) continue;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const isFromMe = msg.key.fromMe;

        // تجاهل الرسائل المرسلة من الحساب نفسه
        if (isFromMe) continue;

        // =========================
        // 1️⃣ الردود التلقائية
        // =========================
        try {
          await handleAutoReplies(sock, msg, accountId);
        } catch (err) {
          logger.warn(
            `⚠️ خطأ في الردود التلقائية [${accountId}]`,
            err
          );
        }

        // =========================
        // 2️⃣ تجميع الروابط (إن كان مفعّل)
        // =========================
        if (!isScrapingEnabled(accountId)) continue;

        let text = '';

        if (msg.message.conversation) {
          text = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
          text = msg.message.extendedTextMessage.text;
        } else {
          continue;
        }

        const links = extractLinks(text);

        if (links.length) {
          saveLinks(accountId, links);

          logger.info(
            `🔗 [${accountId}] روابط جديدة (${isGroup ? 'قروب' : 'خاص'}):`,
            links
          );
        }
      }
    } catch (err) {
      logger.error(
        `❌ خطأ عام في events للحساب ${accountId}`,
        err
      );
    }
  });
}

module.exports = {
  registerWhatsAppEvents
};
