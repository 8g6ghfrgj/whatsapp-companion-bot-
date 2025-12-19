/**
 * Telegram Handler – Link WhatsApp Account (Pairing Code)
 */

const { getAccountsRegistry } = require('../../whatsapp/accounts/registry');
const WhatsAppAccount = require('../../whatsapp/accounts/account');
const logger = require('../../utils/logger');

// حالة انتظار إدخال رقم الهاتف لكل مستخدم
const waitingForPhone = new Map();

/**
 * بدء ربط حساب واتساب
 */
async function startLinkAccount(bot, chatId) {
  waitingForPhone.set(chatId, true);

  await bot.sendMessage(
    chatId,
    '📱 *ربط حساب واتساب*\n\n' +
      'أرسل رقم الهاتف الدولي بدون +\n' +
      'مثال:\n' +
      '`9677XXXXXXXX`\n\n' +
      '⚠️ يجب أن يكون الرقم مفعل عليه واتساب',
    { parse_mode: 'Markdown' }
  );
}

/**
 * استقبال رقم الهاتف وبدء الربط
 */
async function handlePhoneNumber(bot, msg) {
  const chatId = msg.chat.id;
  const phone = msg.text.replace(/\s+/g, '');

  if (!waitingForPhone.get(chatId)) return;

  // تحقق بسيط من الرقم
  if (!/^\d{8,15}$/.test(phone)) {
    await bot.sendMessage(
      chatId,
      '❌ رقم غير صالح.\nأرسل رقم الهاتف الدولي بدون +'
    );
    return;
  }

  waitingForPhone.delete(chatId);

  const registry = getAccountsRegistry();

  // إنشاء حساب جديد
  const accountId = `acc_${Date.now()}`;
  const account = new WhatsAppAccount({ id: accountId });

  registry.add(account);

  await bot.sendMessage(
    chatId,
    '🔗 يتم الآن إنشاء جلسة ربط واتساب...\n\n' +
      '📲 سيتم توليد *رمز اقتران* خلال لحظات\n' +
      'اذهب إلى واتساب:\n' +
      'الأجهزة المرتبطة → ربط جهاز → الربط برقم الهاتف',
    { parse_mode: 'Markdown' }
  );

  try {
    await account.connectWithPairing(phone);

    await bot.sendMessage(
      chatId,
      `🔐 *تم توليد رمز الاقتران*\n\n` +
        `📱 افتح واتساب وأدخل الرمز الظاهر في السيرفر\n\n` +
        `🆔 معرف الحساب:\n\`${accountId}\``,
      { parse_mode: 'Markdown' }
    );

    logger.info(`📱 Pairing بدأ للحساب ${accountId}`);
  } catch (err) {
    logger.error('❌ فشل ربط الحساب', err);

    await bot.sendMessage(
      chatId,
      '❌ حدث خطأ أثناء ربط الحساب.\nحاول مرة أخرى.'
    );
  }
}

module.exports = {
  startLinkAccount,
  handlePhoneNumber
};
