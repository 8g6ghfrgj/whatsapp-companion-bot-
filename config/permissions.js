/**
 * Permissions Configuration
 * يمكن تطويره لاحقًا (Admins / Roles)
 */

const ADMINS = process.env.ADMIN_TELEGRAM_ID
  ? process.env.ADMIN_TELEGRAM_ID.split(',').map(id => id.trim())
  : [];

/**
 * هل المستخدم أدمن؟
 */
function isAdmin(userId) {
  if (!ADMINS.length) return true; // إذا لم يتم تحديد أدمن → الكل مسموح
  return ADMINS.includes(String(userId));
}

/**
 * حماية أمر
 */
function requireAdmin(bot, chatId, userId) {
  if (!isAdmin(userId)) {
    bot.sendMessage(
      chatId,
      '⛔ ليس لديك صلاحية استخدام هذا الأمر'
    );
    return false;
  }
  return true;
}

module.exports = {
  ADMINS,
  isAdmin,
  requireAdmin
};
