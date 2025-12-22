import fs from 'fs';
import path from 'path';
import winston from 'winston';

import { ENV } from '../config/env.js';
import { PATHS } from '../config/paths.js';

// ================================
// Ensure Logs Directory Exists
// ================================
if (!fs.existsSync(PATHS.LOGS)) {
  fs.mkdirSync(PATHS.LOGS, { recursive: true });
}

// ================================
// Log Format
// ================================
const logFormat = winston.format.printf(
  ({ timestamp, level, message }) =>
    `[${timestamp}] [${level.toUpperCase()}] ${message}`
);

// ================================
// Winston Logger
// ================================
export const logger = winston.createLogger({
  level: ENV.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // File logging
    new winston.transports.File({
      filename: path.join(PATHS.LOGS, 'app.log'),
      handleExceptions: true,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),

    // Console logging
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});
