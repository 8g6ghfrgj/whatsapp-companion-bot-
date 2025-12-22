import crypto from 'crypto';
import { LinksRepo } from '../../database/repositories/links.repo.js';
import { SettingsRepo } from '../../database/repositories/settings.repo.js';
import { detectLinkType } from '../../utils/regex.js';
import { logger } from '../../logger/logger.js';

function hashLink(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

export async function handleMessageLinks(accountId, groupJid, links = []) {
  const enabled = await SettingsRepo.get('links_collecting');
  if (enabled !== '1') return;

  for (const url of links) {
    try {
      const type = detectLinkType(url);
      const hash = hashLink(url);

      await LinksRepo.add(accountId, groupJid, url, type, hash);
      logger.info(`Link collected [${type}] ${url}`);
    } catch {
      // رابط مكرر – يتم تجاهله
    }
  }
}
