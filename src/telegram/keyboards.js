export const mainKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🔗 ربط حساب واتساب', callback_data: 'wa_link' },
      ],
      [
        { text: '📱 عرض الحسابات المرتبطة', callback_data: 'wa_accounts' },
      ],
      [
        { text: '▶️ تجميع الروابط', callback_data: 'links_start' },
        { text: '⏹️ توقيف الجمع', callback_data: 'links_stop' },
      ],
      [
        { text: '📂 عرض أقسام الروابط', callback_data: 'links_show' },
      ],
      [
        { text: '📤 تصدير الروابط', callback_data: 'links_export' },
      ],
      [
        { text: '🚀 نشر تلقائي', callback_data: 'post_start' },
        { text: '🛑 إيقاف النشر', callback_data: 'post_stop' },
      ],
      [
        { text: '💬 الردود التلقائية', callback_data: 'reply_toggle' },
      ],
      [
        { text: '👥 الانضمام إلى المجموعات', callback_data: 'group_join' },
      ],
    ],
  },
};
