import path from 'path';
import { ENV } from './env.js';

const ROOT = process.cwd();

export const PATHS = {
  ROOT,

  SRC: path.join(ROOT, 'src'),

  CONFIG: path.join(ROOT, 'src', 'config'),
  DATABASE: path.join(ROOT, 'src', 'database'),
  TELEGRAM: path.join(ROOT, 'src', 'telegram'),
  WHATSAPP: path.join(ROOT, 'src', 'whatsapp'),
  UTILS: path.join(ROOT, 'src', 'utils'),
  STATE: path.join(ROOT, 'src', 'state'),
  LOGGER: path.join(ROOT, 'src', 'logger'),

  CHROME_DATA: path.resolve(ROOT, ENV.PATHS.CHROME_DATA),
  EXPORTS: path.resolve(ROOT, ENV.PATHS.EXPORTS),
  LOGS: path.join(ROOT, 'logs'),

  DATABASE_FILE: path.join(ROOT, 'database.sqlite'),
};
