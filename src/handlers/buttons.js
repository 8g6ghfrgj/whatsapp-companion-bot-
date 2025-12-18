import {
  sendButtonsMessage,
  sendTextMessage
} from '../services/messageService.js';

/**
 * حالة البوت (Runtime State)
 * لا تُحفظ في قاعدة البيانات
 */
const botState = {
  linkCollector: false,
  autoPost: false,
  autoReply: false
};

/**
 * عرض القائمة الرئيسية
 */
export async function showMainMenu(chatId) {
  const buttons = [
    { id: 'link_whatsapp', text: '🔗 ربط حساب واتساب' },
    { id: 'linked_accounts', text: '📱 عرض الحسابات المرتبطة' },
    { id: 'start_collect', text: '📥 تجميع الروابط' },
    { id: 'stop_collect', text: '⛔ توقيف الجمع' },
    { id: 'show_links', text: '📂 عرض الروابط المجمعة' },
    { id: 'export_links', text: '📤 تصدير الروابط' },
    { id: 'auto_post', text: '📢 نشر تلقائي' },
    { id: 'stop_post', text: '🛑 إيقاف النشر التلقائي' },
    { id: 'auto_reply', text: '💬 الردود' },
    { id: 'join_groups', text: '👥 الانضمام إلى المجموعات' }
  ];

  await sendButtonsMessage(
    chatId,
    '📌 اختر العملية التي تريد تنفيذها:',
    buttons
  );
}

/**
 * معالجة ضغط الأزرار
 */
export async function handleButtonAction(message) {
  const { chatId, rawMessage } = message;

  const buttonId =
    rawMessage?.message?.buttonsResponseMessage
      ?.selectedButtonId;

  if (!buttonId) return;

  switch (buttonId) {
    case 'link_whatsapp':
      await sendTextMessage(
        chatId,
        '✅ الحساب مرتبط بالفعل إذا كنت ترى هذه الرسالة.\nإذا لا، أعد تشغيل البوت لمسح QR.'
      );
      break;

    case 'linked_accounts':
      await sendTextMessage(
        chatId,
        '📱 واتساب لا يوفّر API لعرض الأجهزة المرتبطة.\nلكن هذا البوت يعمل كجهاز مصاحب نشط.'
      );
      break;

    case 'start_collect':
      botState.linkCollector = true;
      await sendTextMessage(
        chatId,
        '📥 تم تفعيل تجميع الروابط.'
      );
      break;

    case 'stop_collect':
      botState.linkCollector = false;
      await sendTextMessage(
        chatId,
        '⛔ تم إيقاف تجميع الروابط.'
      );
      break;

    case 'show_links':
      await sendTextMessage(
        chatId,
        '📂 سيتم عرض الروابط المجمعة (قريبًا).'
      );
      break;

    case 'export_links':
      await sendTextMessage(
        chatId,
        '📤 سيتم تصدير الروابط إلى ملفات TXT (قريبًا).'
      );
      break;

    case 'auto_post':
      botState.autoPost = true;
      await sendTextMessage(
        chatId,
        '📢 تم تفعيل النشر التلقائي.'
      );
      break;

    case 'stop_post':
      botState.autoPost = false;
      await sendTextMessage(
        chatId,
        '🛑 تم إيقاف النشر التلقائي.'
      );
      break;

    case 'auto_reply':
      botState.autoReply = !botState.autoReply;
      await sendTextMessage(
        chatId,
        `💬 الردود التلقائية: ${
          botState.autoReply ? 'مفعلة' : 'موقوفة'
        }`
      );
      break;

    case 'join_groups':
      await sendTextMessage(
        chatId,
        '👥 أرسل الآن روابط مجموعات واتساب للانضمام إليها.'
      );
      break;

    default:
      await sendTextMessage(
        chatId,
        '❓ أمر غير معروف.'
      );
  }
}

/**
 * الحصول على حالة البوت
 */
export function getBotState() {
  return botState;
}
