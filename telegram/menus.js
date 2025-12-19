/**
 * Telegram Menus & Keyboards
 */

module.exports = {
  mainMenu: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 لوحة التحكم', callback_data: 'dashboard' }],
        [{ text: '🔗 ربط حساب واتساب', callback_data: 'link_whatsapp' }],
        [{ text: '🔁 اختيار الحساب النشط', callback_data: 'select_active_account' }],
        [{ text: '📱 الحسابات المرتبطة', callback_data: 'list_accounts' }],
        [
          { text: '▶️ تجميع الروابط', callback_data: 'start_scraping' },
          { text: '⏹️ إيقاف الجمع', callback_data: 'stop_scraping' }
        ],
        [
          { text: '📂 عرض الروابط', callback_data: 'view_links' },
          { text: '📤 تصدير الروابط', callback_data: 'export_links' }
        ],
        [
          { text: '📢 نشر تلقائي', callback_data: 'auto_publish' },
          { text: '⛔ إيقاف النشر', callback_data: 'stop_publish' }
        ],
        [{ text: '💬 الردود التلقائية', callback_data: 'replies' }],
        [{ text: '👥 الانضمام إلى القروبات', callback_data: 'join_groups' }]
      ]
    }
  }
};
