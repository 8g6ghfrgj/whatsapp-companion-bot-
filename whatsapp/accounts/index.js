/**
 * WhatsApp Accounts Manager
 * مسؤول عن إنشاء وإدارة عدة حسابات واتساب
 */

const WhatsAppAccount = require('./account');
const {
  loadAccounts,
  addAccount,
  saveAccounts
} = require('./registry');

const logger = require('../../utils/logger');

// الحسابات النشطة في الذاكرة
const activeAccounts = {};

/**
 * إنشاء وربط حساب واتساب جديد
 * @param {string} accountId
 */
async function createAccount(accountId) {
  if (activeAccounts[accountId]) {
    logger.warn(`⚠️ الحساب ${accountId} موجود بالفعل`);
    return activeAccounts[accountId];
  }

  const account = new WhatsAppAccount({ id: accountId });

  try {
    await account.connect();
    activeAccounts[accountId] = account;

    // حفظ الحساب في السجل إذا لم يكن موجودًا
    const data = loadAccounts();
    const exists = data.accounts.find(a => a.id === accountId);

    if (!exists) {
      addAccount({
        id: accountId,
        createdAt: new Date().toISOString()
      });
    }

    logger.info(`✅ تم ربط حساب واتساب: ${accountId}`);
    return account;

  } catch (err) {
    logger.error(`❌ فشل ربط الحساب: ${accountId}`, err);
    throw err;
  }
}

/**
 * جلب حساب واتساب نشط
 * @param {string} accountId
 */
function getAccount(accountId) {
  return activeAccounts[accountId] || null;
}

/**
 * قائمة الحسابات النشطة
 */
function listAccounts() {
  return Object.keys(activeAccounts);
}

/**
 * تسجيل خروج حساب واتساب
 * @param {string} accountId
 */
async function removeAccount(accountId) {
  const account = activeAccounts[accountId];
  if (!account) return false;

  try {
    if (account.sock) {
      await account.sock.logout();
    }
  } catch (err) {
    logger.warn(`⚠️ خطأ أثناء تسجيل خروج الحساب ${accountId}`, err);
  }

  delete activeAccounts[accountId];

  // إزالة من السجل
  const data = loadAccounts();
  data.accounts = data.accounts.filter(a => a.id !== accountId);
  saveAccounts(data);

  logger.info(`🚪 تم تسجيل خروج الحساب: ${accountId}`);
  return true;
}

module.exports = {
  createAccount,
  getAccount,
  listAccounts,
  removeAccount
};
