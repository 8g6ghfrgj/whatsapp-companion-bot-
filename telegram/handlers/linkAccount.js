/**
 * Handler: ربط حساب واتساب (كجهاز مرافق)
 */

const path = require('path');
const fs = require('fs-extra');
const QRCode = require('qrcode');

const { createAccount } = require('../../whatsapp/accounts');
const { loadAccounts } = require('../../whatsapp/accounts/registry');

/**
 * توليد ID فريد للحساب
 */
function generateAccountId() {
  return `acc_${Date.now()}`;
}

/**
 * ربط حساب واتساب جديد
 */
async function handleLinkAccount(bot, chatId) {
  try {
    // منع إنشاء عدد كبير بنفس اللحظة
    const accountsData = loadAccounts();
    if (accountsData.accounts.length >= 10) {
      return bot.sendMessage(
        chatId,
        '⚠️ وصلت للحد الأقصى من الحسابات المرتبطة'
      );
    }

    const accountId = generateAccountId();

    await bot.sendMessage(
      chatId,
      '📲 يتم الآن إنشاء جلسة ربط واتساب...\n\n' +
      '• سيتم إرسال رمز QR خلال لحظات\n' +
      '• افتح واتساب → الأجهزة المرتبطة → ربط جهاز\n' +
      '• امسح رمز QR\n'
    );

    /**
     * إنشاء الحساب (سيولد QR تلقائيًا من Baileys)
     */
    const account = await createAccount(accountId);

    /**
     * الاستماع لملف بيانات الجلسة لالتقاط QR
     * (Baileys يكتب QR داخل events – نقرأه من console hook)
     */
    const sessionPath = path.join(
      __dirname,
      `../../storage/accounts/sessions/${accountId}`
    );

    let qrSent = false;

    account.sock.ev.on('connection.update', async (update) => {
      if (update.qr && !qrSent) {
        qrSent = true;

        try {
          const qrImage = await QRCode.toBuffer(update.qr);

          await bot.sendPhoto(chatId, qrImage, {
            caption:
              '📷 امسح رمز QR من تطبيق واتساب\n\n' +
              'واتساب → الأجهزة المرتبطة → ربط جهاز'
          });
        } catch (err) {
          await bot.sendMessage(
            chatId,
            '❌ فشل إنشاء صورة QR'
          );
        }
      }

      if (update.connection === 'open') {
        await bot.sendMessage(
          chatId,
          `✅ تم ربط حساب واتساب بنجاح\n\n` +
          `🆔 معرف الحساب:\n\`${accountId}\`\n\n` +
          `يمكنك الآن اختياره كحساب نشط من لوحة التحكم`,
          { parse_mode: 'Markdown' }
        );
      }

      if (update.connection === 'close') {
        if (update.lastDisconnect?.error) {
          await bot.sendMessage(
            chatId,
            '⚠️ تم إغلاق الاتصال قبل إتمام الربط'
          );
        }
      }
    });

  } catch (err) {
    console.error(err);
    await bot.sendMessage(
      chatId,
      '❌ حدث خطأ أثناء ربط حساب واتساب'
    );
  }
}

module.exports = {
  handleLinkAccount
};
