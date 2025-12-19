const fs = require('fs');
const path = require('path');
const bot = require('./botInstance'); // نفس البوت المستخدم في المشروع

async function sendQRToTelegram(accountId, qrBuffer) {
  const caption =
    `📲 *ربط حساب واتساب*\n\n` +
    `🆔 الحساب: \`${accountId}\`\n\n` +
    `افتح واتساب → الأجهزة المرتبطة → ربط جهاز\n` +
    `وامسح الرمز الآن ⏱️`;

  await bot.sendPhoto(
    process.env.TELEGRAM_ADMIN_ID,
    qrBuffer,
    {
      caption,
      parse_mode: 'Markdown'
    }
  );
}

module.exports = { sendQRToTelegram };
