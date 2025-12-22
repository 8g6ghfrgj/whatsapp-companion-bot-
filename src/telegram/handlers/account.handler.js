import { bot } from '../bot.js';
import * as AccountsRepo from '../../database/repositories/accounts.repo.js';
import {
  startWhatsAppSession,
  getCurrentQR,
  isWhatsAppLoggedIn,
  logoutWhatsApp,
  destroyWhatsAppSession,
} from '../../whatsapp/whatsapp.controller.js';

import { accountListKeyboard } from '../keyboards.js';

/**
 * رابط حساب واتساب
 * - يرسل QR فورًا
 * - يعيد إرسال QR إذا كان موجود
 * - لا ينشئ حساب إلا بعد تسجيل الدخول فعليًا
 */
export async function link(chatId) {
  try {
    // 1) إذا كان واتساب مسجل دخول فعليًا
    if (await isWhatsAppLoggedIn()) {
      const existing = await AccountsRepo.getActive();
      if (!existing) {
        await AccountsRepo.create({
          name: `Account-${Date.now()}`,
          is_active: 1,
        });
      }

      await bot.sendMessage(chatId, '✅ تم ربط حساب واتساب بنجاح');
      return;
    }

    // 2) لو QR موجود مسبقًا → أعد إرساله فورًا
    const cachedQR = getCurrentQR();
    if (cachedQR) {
      await bot.sendPhoto(chatId, cachedQR, {
        caption: '📲 امسح رمز QR لربط حساب واتساب',
      });
      return;
    }

    // 3) لا QR ولا تسجيل دخول → ابدأ Session جديدة
    await bot.sendMessage(chatId, '⏳ جارٍ إنشاء جلسة واتساب، انتظر لحظة...');
    await startWhatsAppSession(async (qrBuffer) => {
      // يُستدعى فور ظهور QR (أقصى سرعة)
      await bot.sendPhoto(chatId, qrBuffer, {
        caption: '📲 امسح رمز QR لربط حساب واتساب',
      });
    });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ فشل بدء ربط واتساب');
  }
}

/**
 * عرض الحسابات المرتبطة
 * مع أزرار (تسجيل خروج / حذف)
 */
export async function list(chatId) {
  const accounts = await AccountsRepo.getAll();

  if (!accounts.length) {
    await bot.sendMessage(chatId, '📱 لا يوجد حسابات مرتبطة حاليًا');
    return;
  }

  let text = '📱 الحسابات المرتبطة:\n\n';
  for (const acc of accounts) {
    text += `• ${acc.name} (${acc.is_active ? 'نشط' : 'غير نشط'})\n`;
  }

  await bot.sendMessage(chatId, text, {
    reply_markup: accountListKeyboard(accounts),
  });
}

/**
 * تسجيل خروج من واتساب (Logout)
 */
export async function logout(chatId, accountId) {
  try {
    await logoutWhatsApp();
    await AccountsRepo.setInactive(accountId);

    await bot.sendMessage(chatId, '🔓 تم تسجيل الخروج من حساب واتساب');
  } catch (err) {
    await bot.sendMessage(chatId, '❌ فشل تسجيل الخروج');
  }
}

/**
 * حذف الجلسة نهائيًا
 * (حذف Chrome profile + DB)
 */
export async function remove(chatId, accountId) {
  try {
    await destroyWhatsAppSession();
    await AccountsRepo.deleteById(accountId);

    await bot.sendMessage(chatId, '🗑️ تم حذف الجلسة نهائيًا');
  } catch (err) {
    await bot.sendMessage(chatId, '❌ فشل حذف الجلسة');
  }
}
