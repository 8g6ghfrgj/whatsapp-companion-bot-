/**
 * Handler: الانضمام إلى قروبات واتساب + التقارير
 * - استقبال روابط قروبات واتساب فقط
 * - إضافتها إلى طابور الحساب النشط
 * - بدء المعالجة (كل 2 دقيقة لكل رابط)
 * - عرض تقرير الانضمام
 */

const fs = require('fs');
const path = require('path');

const { getActiveAccountId } = require('./activeAccount');
const { getAccount } = require('../../whatsapp/accounts');

/**
 * جلب الحساب النشط أو إرسال تنبيه
 */
function getActiveAccountOrFail(bot, chatId) {
  const accId = getActiveAccountId();

  if (!accId) {
    bot.sendMessage(
      chatId,
      '⚠️ لا يوجد حساب واتساب نشط\n\nيرجى اختيار حساب من زر 🔁 اختيار الحساب النشط'
    );
    return null;
  }

  const account = getAccount(accId);
  if (!account || !account.sock) {
    bot.sendMessage(chatId, '❌ الحساب النشط غير متصل حالياً');
    return null;
  }

  return account;
}

/**
 * مسارات التخزين للحساب
 */
function getGroupsDir(accountId) {
  return path.join(
    __dirname,
    `../../storage/accounts/data/${accountId}/groups`
  );
}

function getQueueFile(accountId) {
  return path.join(getGroupsDir(accountId), 'queue.json');
}

function getReportFile(accountId) {
  return path.join(getGroupsDir(accountId), 'report.json');
}

/**
 * تهيئة ملفات القروبات إن لم تكن موجودة
 */
function ensureGroupFiles(accountId) {
  const dir = getGroupsDir(accountId);
  fs.mkdirSync(dir, { recursive: true });

  const queueFile = getQueueFile(accountId);
  const reportFile = getReportFile(accountId);

  if (!fs.existsSync(queueFile)) {
    fs.writeFileSync(queueFile, JSON.stringify({ links: [] }, null, 2));
  }

  if (!fs.existsSync(reportFile)) {
    fs.writeFileSync(
      reportFile,
      JSON.stringify({ joined: [], pending: [], failed: [] }, null, 2)
    );
  }
}

/**
 * التحقق من رابط قروب واتساب
 */
function isWhatsAppGroupLink(link) {
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(link);
}

/**
 * إضافة روابط القروبات إلى الطابور
 */
async function handleJoinGroups(bot, chatId) {
  const account = getActiveAccountOrFail(bot, chatId);
  if (!account) return;

  ensureGroupFiles(account.id);

  await bot.sendMessage(
    chatId,
    '👥 أرسل روابط قروبات واتساب فقط\n\n' +
    '• كل رابط في سطر\n' +
    '• سيتم الانضمام بمعدل رابط كل 2 دقيقة\n' +
    '• القروبات التي تتطلب موافقة ستُسجل كـ (بانتظار)'
  );

  bot.once('message', async (msg) => {
    if (!msg.text) {
      return bot.sendMessage(chatId, '❌ الرجاء إرسال روابط نصية فقط');
    }

    const links = msg.text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length);

    const validLinks = links.filter(isWhatsAppGroupLink);

    if (!validLinks.length) {
      return bot.sendMessage(
        chatId,
        '❌ لم يتم العثور على روابط قروبات واتساب صالحة'
      );
    }

    const queueFile = getQueueFile(account.id);
    const queueData = JSON.parse(fs.readFileSync(queueFile));

    // منع التكرار
    const newLinks = validLinks.filter(
      l => !queueData.links.includes(l)
    );

    queueData.links.push(...newLinks);
    fs.writeFileSync(queueFile, JSON.stringify(queueData, null, 2));

    await bot.sendMessage(
      chatId,
      `✅ تم استلام ${newLinks.length} رابط\n\n` +
      '⏳ سيتم الانضمام تلقائياً بفاصل 2 دقيقة لكل رابط'
    );
  });
}

/**
 * عرض تقرير الانضمام
 */
async function handleGroupsReport(bot, chatId) {
  const account = getActiveAccountOrFail(bot, chatId);
  if (!account) return;

  ensureGroupFiles(account.id);

  const reportFile = getReportFile(account.id);
  const report = JSON.parse(fs.readFileSync(reportFile));

  let message =
`📊 *تقرير الانضمام إلى القروبات*
────────────────────
👤 الحساب:
\`${account.id}\`

✅ تم الانضمام:
*${report.joined.length}*

⏳ بانتظار الموافقة:
*${report.pending.length}*

❌ فشل:
*${report.failed.length}*
`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown'
  });
}

module.exports = {
  handleJoinGroups,
  handleGroupsReport
};
