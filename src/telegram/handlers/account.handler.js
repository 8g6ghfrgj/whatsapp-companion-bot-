import fs from 'fs';
import { bot } from '../bot.js';
import { AccountsRepo } from '../../database/repositories/accounts.repo.js';
import { linkAccount } from '../../whatsapp/whatsapp.controller.js';

export async function link(chatId) {
  const accountName = `Account-${Date.now()}`;

  const accountId = await AccountsRepo.create(
    accountName,
    accountName
  );

  await linkAccount(accountId, (qrPath) => {
    bot.sendPhoto(
      chatId,
      fs.createReadStream(qrPath),
      { caption: '📱 امسح رمز QR من واتساب لربط الحساب' }
    );
  });

  bot.sendMessage(chatId, '✅ تم ربط حساب واتساب بنجاح');
}

export async function list(chatId) {
  const accounts = await AccountsRepo.getAll();

  if (!accounts.length) {
    return bot.sendMessage(chatId, '❌ لا توجد حسابات مرتبطة');
  }

  const text = accounts
    .map(a => `• ${a.id} - ${a.name} (${a.is_active ? 'نشط' : 'موقوف'})`)
    .join('\n');

  bot.sendMessage(chatId, `📱 الحسابات المرتبطة:\n\n${text}`);
}
