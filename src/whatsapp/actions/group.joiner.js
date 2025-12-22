import { delay } from '../../utils/delay.js';
import { db } from '../../database/db.js';
import { logger } from '../../logger/logger.js';

const GROUP_LINK_REGEX = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;

function isValidGroupLink(link) {
  return GROUP_LINK_REGEX.test(link);
}

export async function joinGroups(page, links = []) {
  const report = [];

  for (const raw of links) {
    const link = raw.trim();

    if (!isValidGroupLink(link)) {
      report.push({ link, status: 'invalid' });
      continue;
    }

    try {
      logger.info(`Opening group link: ${link}`);

      await page.goto(link, { waitUntil: 'networkidle2' });
      await delay(5000);

      const status = await page.evaluate(() => {
        const joinBtn = document.querySelector('[data-testid="join-group"]');
        const requestBtn = document.querySelector('[data-testid="request-to-join"]');

        if (joinBtn) {
          joinBtn.click();
          return 'joined';
        }

        if (requestBtn) {
          requestBtn.click();
          return 'requested';
        }

        return 'unknown';
      });

      if (status === 'requested') {
        db.run(
          `INSERT INTO join_requests (group_link, status)
           VALUES (?, ?)`,
          [link, 'pending']
        );
      }

      report.push({ link, status });
      await delay(120000); // 2 دقائق
    } catch {
      report.push({ link, status: 'failed' });
    }
  }

  return report;
}
