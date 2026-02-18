import 'dotenv/config';
import { Bot } from './bot/bot';
import { AccessControl } from './services/access';
import { Downloader } from './services/downloader';
import { logger } from './utils/logger';
import { cleanupAllTempDirs } from './utils/temp';

function validateEnv(): void {
  const required = ['TELEGRAM_TOKEN', 'ALLOWED_USER_IDS'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(
      { missing },
      `Missing required environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();

  // Cleanup temp dirs on startup
  await cleanupAllTempDirs();

  const telegramToken = process.env.TELEGRAM_TOKEN!;
  const allowedUserIds = process.env.ALLOWED_USER_IDS!;
  const downloadTimeout = parseInt(process.env.DOWNLOAD_TIMEOUT || '120', 10);
  const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '49', 10);

  logger.info(
    {
      downloadTimeout,
      maxFileSizeMB,
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    'Configuration loaded'
  );

  const accessControl = new AccessControl(allowedUserIds);
  const downloader = new Downloader({
    downloadTimeout,
    maxFileSizeMB,
  });

  const bot = new Bot(telegramToken, accessControl, downloader, maxFileSizeMB);

  try {
    await bot.launch();
  } catch (error) {
    logger.error({ error }, 'Failed to launch bot');
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
