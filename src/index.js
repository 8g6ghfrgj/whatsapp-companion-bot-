// ================================
// Core Bootstrap File
// src/index.js
// ================================

import fs from 'fs';
import process from 'process';

// Config & Core
import { ENV } from './config/env.js';
import { PATHS } from './config/paths.js';
import { logger } from './logger/logger.js';

// Database
import { initDatabase } from './database/db.js';

// ================================
// Telegram (CRITICAL ORDER)
// ================================
import './telegram/bot.js';     // ⬅️ لازم أولاً
import './telegram/router.js';  // ⬅️ بعدها

// WhatsApp (controller side-effects only)
import './whatsapp/whatsapp.controller.js';

// ================================
// Ensure Required Directories
// ================================
function ensureDirectories() {
  const dirs = [
    PATHS.CHROME_DATA,
    `${PATHS.CHROME_DATA}/accounts`,
    PATHS.EXPORTS,
    `${PATHS.EXPORTS}/links`,
    PATHS.LOGS,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

// ================================
// Graceful Shutdown
// ================================
function handleShutdown(signal) {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// ================================
// Bootstrap Application
// ================================
async function bootstrap() {
  logger.info('====================================');
  logger.info(`Starting ${ENV.APP_NAME}`);
  logger.info(`Environment: ${ENV.NODE_ENV}`);
  logger.info('====================================');

  ensureDirectories();
  initDatabase();

  logger.info('Telegram bot initialized');
  logger.info('System is up and running');
}

// ================================
// Start
// ================================
bootstrap().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});
