import { getSocket } from './connect.js';

/**
 * استخراج نص الرسالة من جميع أنواع الرسائل
 */
function extractMessageText(message) {
  if (!message) return null;

  if (message.conversation) {
    return message.conversation;
  }

  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }

  if (message.imageMessage?.caption) {
    return message.imageMessage.caption;
  }

  if (message.videoMessage?.caption) {
    return message.videoMessage.caption;
  }

  return null;
}

/**
 * بدء الاستماع للرسائل
 */
export function startMessageListener(onMessageCallback) {
  const sock = getSocket();

  sock.ev.on('messages.upsert', async (event) => {
    const { messages, type } = event;

    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      const chatId = msg.key.remoteJid;
      const isGroup = chatId.endsWith('@g.us');
      const senderId = isGroup
        ? msg.key.participant
        : chatId;

      const text = extractMessageText(msg.message);

      const normalizedMessage = {
        id: msg.key.id,
        chatId,
        senderId,
        isGroup,
        text,
        timestamp: msg.messageTimestamp,
        rawMessage: msg
      };

      // تمرير الرسالة لأي منطق لاحق (handlers)
      if (typeof onMessageCallback === 'function') {
        try {
          await onMessageCallback(normalizedMessage);
        } catch (error) {
          console.error('❌ Message handler error:', error);
        }
      }
    }
  });
}
