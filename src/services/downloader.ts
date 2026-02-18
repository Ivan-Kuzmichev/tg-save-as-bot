import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { createTempDir, cleanupTempDir } from '../utils/temp';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  title?: string;
  error?: string;
  fileSize?: number;
}

export interface DownloaderConfig {
  downloadTimeout: number;
  maxFileSizeMB: number;
}

export class Downloader {
  private config: DownloaderConfig;

  constructor(config: DownloaderConfig) {
    this.config = config;
  }

  async download(url: string): Promise<DownloadResult> {
    const requestId = uuidv4();
    const tempDir = await createTempDir(requestId);

    logger.info({ requestId, url }, 'Starting download');

    const startTime = Date.now();

    try {
      const result = await this.runYtDlp(url, tempDir, requestId);

      if (!result.success) {
        await cleanupTempDir(tempDir);
        return result;
      }

      const filePath = result.filePath!;
      const stats = await fs.stat(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      logger.info(
        { requestId, fileSizeMB, executionTime: Date.now() - startTime },
        'Download completed'
      );

      // Check file size
      if (fileSizeMB > this.config.maxFileSizeMB) {
        logger.warn({ requestId, fileSizeMB }, 'File too large, trying lower quality');
        await cleanupTempDir(tempDir);
        return await this.downloadLowerQuality(url, requestId);
      }

      return {
        success: true,
        filePath,
        title: result.title,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error({ requestId, error }, 'Download failed');
      await cleanupTempDir(tempDir);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async runYtDlp(
    url: string,
    tempDir: string,
    requestId: string
  ): Promise<DownloadResult> {
    return new Promise((resolve) => {
      const outputPath = path.join(tempDir, '%(title)s.%(ext)s');

      // Check if it's Instagram URL
      const isInstagram = url.includes('instagram.com');

      const args = [
        '--no-playlist',
        '--no-progress',
        ...(isInstagram ? [
          // Instagram-specific: download combined video+audio format
          '-f',
          'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--merge-output-format',
          'mp4',
          // Force H.264 video and AAC audio for iOS compatibility
          '--postprocessor-args',
          'ffmpeg:-c:v libx264 -c:a aac -pix_fmt yuv420p -movflags +faststart',
        ] : [
          '-f',
          'bestvideo+bestaudio/best',
          '--merge-output-format',
          'mp4',
          '--remux-video',
          'mp4',
        ]),
        '-o',
        outputPath,
        url,
      ];

      logger.debug({ requestId, args }, 'Running yt-dlp');

      const ytDlp = spawn('yt-dlp', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        ytDlp.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Download timeout',
        });
      }, this.config.downloadTimeout * 1000);

      ytDlp.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      ytDlp.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      ytDlp.on('close', async (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          // Find the downloaded file and extract title from filename
          try {
            const files = await fs.readdir(tempDir);
            const videoFile = files.find((f) => 
              f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm') || f.endsWith('.mov')
            );

            if (videoFile) {
              // Extract title from filename (remove extension)
              const title = path.basename(videoFile, path.extname(videoFile));
              resolve({
                success: true,
                filePath: path.join(tempDir, videoFile),
                title: title || 'Unknown',
              });
            } else {
              resolve({
                success: false,
                error: 'No video file found after download',
              });
            }
          } catch (err) {
            resolve({
              success: false,
              error: 'Failed to find downloaded file',
            });
          }
        } else {
          const errorMessage = this.parseYtDlpError(errorOutput);
          resolve({
            success: false,
            error: errorMessage,
          });
        }
      });

      ytDlp.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `yt-dlp failed to start: ${err.message}`,
        });
      });
    });
  }

  private async downloadLowerQuality(url: string, requestId: string): Promise<DownloadResult> {
    const tempDir = await createTempDir(requestId);

    logger.info({ requestId, url }, 'Attempting lower quality download');

    try {
      const result = await this.runYtDlpLowerQuality(url, tempDir, requestId);

      if (!result.success) {
        await cleanupTempDir(tempDir);
        return result;
      }

      const filePath = result.filePath!;
      const stats = await fs.stat(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      logger.info(
        { requestId, fileSizeMB },
        'Lower quality download completed'
      );

      return {
        success: true,
        filePath,
        title: result.title,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error({ requestId, error }, 'Lower quality download failed');
      await cleanupTempDir(tempDir);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async runYtDlpLowerQuality(
    url: string,
    tempDir: string,
    requestId: string
  ): Promise<DownloadResult> {
    return new Promise((resolve) => {
      const outputPath = path.join(tempDir, '%(title)s.%(ext)s');

      // Check if it's Instagram URL
      const isInstagram = url.includes('instagram.com');

      const args = [
        '--no-playlist',
        '--no-progress',
        ...(isInstagram ? [
          // Instagram-specific: download combined video+audio format
          '-f',
          'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best',
          '--merge-output-format',
          'mp4',
          // Force H.264 video and AAC audio for iOS compatibility
          '--postprocessor-args',
          'ffmpeg:-c:v libx264 -c:a aac -pix_fmt yuv420p -movflags +faststart',
        ] : [
          '-f',
          'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
          '--merge-output-format',
          'mp4',
          '--remux-video',
          'mp4',
        ]),
        '-o',
        outputPath,
        url,
      ];

      logger.debug({ requestId, args }, 'Running yt-dlp (lower quality)');

      const ytDlp = spawn('yt-dlp', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        ytDlp.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Download timeout',
        });
      }, this.config.downloadTimeout * 1000);

      ytDlp.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      ytDlp.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      ytDlp.on('close', async (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          try {
            const files = await fs.readdir(tempDir);
            const videoFile = files.find((f) => 
              f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm') || f.endsWith('.mov')
            );

            if (videoFile) {
              const title = path.basename(videoFile, path.extname(videoFile));
              resolve({
                success: true,
                filePath: path.join(tempDir, videoFile),
                title: title || 'Unknown',
              });
            } else {
              resolve({
                success: false,
                error: 'No video file found after download',
              });
            }
          } catch (err) {
            resolve({
              success: false,
              error: 'Failed to find downloaded file',
            });
          }
        } else {
          const errorMessage = this.parseYtDlpError(errorOutput);
          resolve({
            success: false,
            error: errorMessage,
          });
        }
      });

      ytDlp.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `yt-dlp failed to start: ${err.message}`,
        });
      });
    });
  }

  private parseYtDlpError(errorOutput: string): string {
    const lowerError = errorOutput.toLowerCase();

    if (lowerError.includes('private')) {
      return 'This content is private or requires authentication';
    }
    if (lowerError.includes('geo') || lowerError.includes('blocked')) {
      return 'This content is not available in your region';
    }
    if (lowerError.includes('unavailable') || lowerError.includes('deleted')) {
      return 'This content is no longer available';
    }
    if (lowerError.includes('unsupported')) {
      return 'This URL is not supported';
    }
    if (lowerError.includes('sign in') || lowerError.includes('login')) {
      return 'Authentication required to access this content';
    }

    return 'Failed to download content';
  }
}
