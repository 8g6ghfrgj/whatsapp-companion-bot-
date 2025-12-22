import { launchChrome } from './browser/chrome.js';
import { getProfilePath } from './browser/profile.manager.js';
import { isSessionAlive } from './browser/session.guard.js';

import { waitForQR } from './auth/qr.watcher.js';
import { isLoggedIn } from './auth/login.state.js';

import { scanAllChats } from './listeners/chat.scanner.js';
import { listenForNewMessages } from './listeners/message.listener.js';

import { handleMessageLinks } from './actions/link.collector.js';
import { handleAutoReply } from './actions/auto.reply.js';
import { startAutoPosting, stopAutoPosting } from './actions/auto.poster.js';
import { joinGroups } from './actions/group.joiner.js';

import { logger } from '../logger/logger.js';

let browser = null;
let page = null;
let currentAccountId = null;

// =====================================
// Link WhatsApp Account (QR Flow)
// =====================================
export async function linkAccount(accountId, onQR) {
  if (browser) {
    logger.warn('Browser already running');
    return;
  }

  currentAccountId = accountId;
  const profilePath = getProfilePath(accountId);

  browser = await launchChrome(profilePath);
  page = await browser.newPage();

  await page.goto('https://web.whatsapp.com', {
    waitUntil: 'networkidle2',
  });

  const loggedIn = await isLoggedIn(page);

  if (!loggedIn) {
    await waitForQR(page, onQR);
    logger.info('QR sent, waiting for scan...');
    await page.waitForNavigation({ timeout: 0 });
  }

  logger.info('WhatsApp linked successfully');

  await startListeners();
}

// =====================================
// Start Message Listeners
// =====================================
async function startListeners() {
  if (!page) return;

  // قراءة الرسائل القديمة
  await scanAllChats(page, (msg) => {
    handleMessageLinks(currentAccountId, 'unknown', msg.links || []);
  });

  // مراقبة الرسائل الجديدة
  await listenForNewMessages(page, async (msg) => {
    await handleMessageLinks(currentAccountId, 'unknown', msg.links || []);
    await handleAutoReply(page, msg);
  });

  logger.info('WhatsApp listeners started');
}

// =====================================
// Auto Posting Control
// =====================================
export async function startPosting() {
  if (!page) throw new Error('WhatsApp not ready');
  await startAutoPosting(page);
}

export function stopPosting() {
  stopAutoPosting();
}

// =====================================
// Group Join Control
// =====================================
export async function startGroupJoin(links) {
  if (!page) throw new Error('WhatsApp not ready');
  return await joinGroups(page, links);
}

// =====================================
// Session Health Check
// =====================================
export async function checkSession() {
  if (!page) return false;
  return await isSessionAlive(page);
}

// =====================================
// Shutdown
// =====================================
export async function shutdownWhatsApp() {
  try {
    if (browser) {
      await browser.close();
      browser = null;
      page = null;
      currentAccountId = null;
      logger.info('WhatsApp browser closed');
    }
  } catch (err) {
    logger.error('Failed to shutdown WhatsApp');
  }
}
