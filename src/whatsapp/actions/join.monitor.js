import { db } from '../../database/db.js';
import { logger } from '../../logger/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function checkPendingJoins() {
  db.all(
    `SELECT * FROM join_requests WHERE status = 'pending'`,
    [],
    (err, rows) => {
      if (err) return;

      const now = Date.now();

      for (const row of rows) {
        const requestedAt = new Date(row.requested_at).getTime();
        if (now - requestedAt >= DAY_MS) {
          logger.warn(
            `Join request pending >24h: ${row.group_link}`
          );
        }
      }
    }
  );
}
