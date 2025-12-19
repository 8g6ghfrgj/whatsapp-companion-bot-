/**
 * WhatsApp Auto Replies Engine
 * مسؤول عن:
 * - الردود التلقائية في الخاص
 * - الردود التلقائية في القروبات
 * - تشغيل / إيقاف لكل حساب بشكل مستقل
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * مسار إعدادات الردود لكل حساب
 */
function getRepliesConfigPath(accountId) {
  return path.join(
    __dirname,
    `../storage/accounts/data/${accountId}/replies/config.json`
  );
}

/**
 * تحميل إعدادات الردود
 */
function loadRepliesConfig(accountId) {
  const file = getRepliesConfigPath(accountId);

  if (!fs.existsSync(file)) {
    return {
      enabled: false,
      private_reply: '',
      group_reply: ''
    };
  }

  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (err) {
    logger.error(
      `❌ فشل قراءة إعدادات الردود للحساب ${accountId}`,
      err
    );
    return {
      enabled: false,
      private_reply: '',
      group_reply: ''
    };
  }
}

/**
 * معالجة الردود التلقائية
 * @param {object} sock - WASocket
 * @param {object} msg  - Message Object
 * @param {string} accountId
 */
async function handleAutoReplies(sock, msg, accountId) {
  try {
    const config = loadRepliesConfig(accountId);
    if (!config.enabled) return;
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    // تجاهل رسائل الحساب نفسه
    if (msg.key.fromMe) return;

    // تجاهل الرسائل التي لا تحتوي نص
    let text = '';
    if (msg.message.conversation) {
      text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text;
    }

    if (!text) return;

    // =========================
    // رد خاص
    // =========================
    if (!isGroup && config.private_reply) {
      await sock.sendMessage(from, {
        text: config.private_reply
      });

      logger.info(
        `💬 [${accountId}] رد تلقائي (خاص) → ${from}`
      );
      return;
    }

    // =========================
    // رد قروبات
    // =========================
    if (isGroup && config.group_reply) {
      await sock.sendMessage(from, {
        text: config.group_reply
      });

      logger.info(
        `💬 [${accountId}] رد تلقائي (قروب) → ${from}`
      );
    }
  } catch (err) {
    logger.error(
      `❌ خطأ في الردود التلقائية للحساب ${accountId}`,
      err
    );
  }
}

module.exports = {
  handleAutoReplies
};
