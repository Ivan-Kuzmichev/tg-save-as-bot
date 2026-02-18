import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

const TEMP_BASE_DIR = path.join(process.cwd(), 'temp');

export async function createTempDir(requestId: string): Promise<string> {
  const tempDir = path.join(TEMP_BASE_DIR, requestId);
  await fs.ensureDir(tempDir);
  logger.debug({ tempDir }, 'Created temp directory');
  return tempDir;
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.remove(tempDir);
    logger.debug({ tempDir }, 'Cleaned up temp directory');
  } catch (error) {
    logger.warn({ tempDir, error }, 'Failed to cleanup temp directory');
  }
}

export async function cleanupAllTempDirs(): Promise<void> {
  try {
    if (await fs.pathExists(TEMP_BASE_DIR)) {
      await fs.remove(TEMP_BASE_DIR);
      logger.info({ tempBaseDir: TEMP_BASE_DIR }, 'Cleaned up all temp directories');
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to cleanup all temp directories');
  }
}
