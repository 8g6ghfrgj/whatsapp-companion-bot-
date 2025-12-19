/**
 * Telegram Bot Entry Point
 * مسؤول عن:
 * - تشغيل بوت تيليجرام
 * - أوامر /start
 * - أزرار لوحة التحكم
 * - تمرير الرسائل إلى handlers
 */

const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

const { showMainMenu } = require('./menus');
const {
  startLinkAccount,
  handlePhoneNumber
} = require('./handlers/link_account');

// إنشاء البوت
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true
});

/**
 * /start
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await showMainMenu(bot, chatId);
  } catch (err) {
    logger.error('❌ خطأ في /start', err);
  }
});

/**
 * استقبال ضغط الأزرار (Inline Keyboard)
 */
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'LINK_ACCOUNT') {
      await startLinkAccount(bot, chatId);
    }
  } catch (err) {
    logger.error('❌ خطأ في callback_query', err);
  } finally {
    // إغلاق التحميل في تيليجرام
    bot.answerCallbackQuery(query.id).catch(() => {});
  }
});

/**
 * استقبال الرسائل النصية (رقم الهاتف)
 */
bot.on('message', async (msg) => {
  // تجاهل الأوامر
  if (msg.text && msg.text.startsWith('/')) return;

  try {
    await handlePhoneNumber(bot, msg);
  } catch (err) {
    logger.error('❌ خطأ في معالجة الرسالة', err);
  }
});

logger.info('🤖 Telegram Bot Started');

module.exports = bot;
