import { bot } from '../bot.js';
import { startGroupJoin } from '../../whatsapp/whatsapp.controller.js';

const pendingChats = new Map();

export async function join(chatId) {
  pendingChats.set(chatId, true);

  bot.sendMessage(
    chatId,
    '👥 أرسل روابط مجموعات واتساب (كل رابط في سطر واحد)'
  );
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (!pendingChats.has(chatId)) return;
  if (!msg.text) return;

  pendingChats.delete(chatId);

  const links = msg.text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  bot.sendMessage(chatId, '⏳ جاري الانضمام إلى المجموعات...');

  const report = await startGroupJoin(links);

  let result = '📊 تقرير الانضمام:\n\n';
  for (const r of report) {
    result += `• ${r.link} → ${r.status}\n`;
  }

  bot.sendMessage(chatId, result.slice(0, 4000));
});
