/**
 * Telegram Menus
 * يحتوي على لوحات التحكم والأزرار
 */

async function showMainMenu(bot, chatId) {
  await bot.sendMessage(
    chatId,
    '👋 *لوحة التحكم*\n\n' +
      'اختر العملية التي تريد تنفيذها:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 ربط حساب واتساب',
              callback_data: 'LINK_ACCOUNT'
            }
          ]
        ]
      }
    }
  );
}

module.exports = {
  showMainMenu
};
