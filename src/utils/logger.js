import fs from 'fs';
import path from 'path';
import config from '../config.js';

/**
 * التأكد من وجود مجلد السجلات
 */
function ensureLogDir() {
  if (!fs.existsSync(config.paths.logs)) {
    fs.mkdirSync(config.paths.logs, { recursive: true });
  }
}

/**
 * تنسيق التاريخ
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * كتابة سجل
 */
function writeLog(level, message) {
  ensureLogDir();

  const logLine = `[${getTimestamp()}] [${level.toUpperCase()}] ${message}\n`;
  const logFile = path.join(
    config.paths.logs,
    'bot.log'
  );

  fs.appendFileSync(logFile, logLine, {
    encoding: 'utf-8'
  });

  console.log(logLine.trim());
}

export const logger = {
  info(message) {
    writeLog('info', message);
  },

  warn(message) {
    writeLog('warn', message);
  },

  error(message) {
    writeLog('error', message);
  }
};
