import { Context, Telegraf } from 'telegraf';
import { AccessControl } from '../services/access';
import { Downloader, DownloadResult } from '../services/downloader';
import { logger } from '../utils/logger';
import { extractUrls } from '../utils/url';
import { cleanupTempDir } from '../utils/temp';

interface SessionData {
  isProcessing: boolean;
  lastRequestTime: number;
}

interface BotContext extends Context {
  session?: SessionData;
}

export class Bot {
  private bot: Telegraf<BotContext>;
  private accessControl: AccessControl;
  private downloader: Downloader;
  private userSessions: Map<number, SessionData> = new Map();
  private readonly cooldownMs = 5000;
  private readonly maxFileSizeBytes: number;

  constructor(
    telegramToken: string,
    accessControl: AccessControl,
    downloader: Downloader,
    maxFileSizeMB: number
  ) {
    this.bot = new Telegraf<BotContext>(telegramToken);
    this.accessControl = accessControl;
    this.downloader = downloader;
    this.maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Start command
    this.bot.start((ctx) => {
      const userId = ctx.from?.id;
      if (!userId || !this.accessControl.isAllowed(userId)) {
        return ctx.reply('❌ Access denied. This bot is restricted to authorized users only.');
      }
      ctx.reply(
        '👋 Welcome! Send me a link from Instagram, TikTok, YouTube, Twitter, or any supported platform and I\'ll download it for you.'
      );
    });

    // Handle messages
    this.bot.on('message', async (ctx) => {
      const userId = ctx.from?.id;
      const message = ctx.message;

      if (!userId || !message || !('text' in message)) {
        return;
      }

      const text = message.text;
      if (!text) {
        return;
      }

      // Check access
      if (!this.accessControl.isAllowed(userId)) {
        logger.warn({ userId }, 'Unauthorized access attempt');
        return ctx.reply('❌ Access denied. This bot is restricted to authorized users only.');
      }

      // Check cooldown
      const session = this.userSessions.get(userId);
      if (session?.isProcessing) {
        return ctx.reply('⏳ Please wait for the current download to complete.');
      }

      if (session && Date.now() - session.lastRequestTime < this.cooldownMs) {
        return ctx.reply('⏳ Please wait a few seconds before sending another request.');
      }

      // Extract URLs
      const urls = extractUrls(text);
      if (urls.length === 0) {
        return ctx.reply('❓ Please send a valid URL. I support Instagram, TikTok, YouTube, Twitter, and more.');
      }

      // Set session
      this.userSessions.set(userId, { isProcessing: true, lastRequestTime: Date.now() });

      try {
        // Process URLs sequentially
        for (const url of urls) {
          await this.processUrl(ctx, url, userId);
        }
      } finally {
        // Reset session
        this.userSessions.set(userId, { isProcessing: false, lastRequestTime: Date.now() });
      }
    });

    // Error handler
    this.bot.catch((err, ctx) => {
      logger.error({ err, ctx }, 'Bot error');
      ctx.reply('❌ An error occurred. Please try again later.');
    });
  }

  private async processUrl(
    ctx: BotContext,
    url: string,
    userId: number
  ): Promise<void> {
    logger.info({ userId, url }, 'Processing URL');

    const statusMessage = await ctx.reply(`🔄 Downloading...`);

    if (!ctx.chat) {
      return;
    }

    const chatId = ctx.chat.id;

    try {
      const result = await this.downloader.download(url);

      if (!result.success) {
        await ctx.telegram.editMessageText(
          chatId,
          statusMessage.message_id,
          undefined,
          `❌ Error: ${result.error}`
        );
        return;
      }

      await ctx.telegram.editMessageText(
        chatId,
        statusMessage.message_id,
        undefined,
        `✅ Download complete! Sending video...`
      );

      // Send video
      await this.sendVideo(ctx, result, url);

      // Delete status message
      await ctx.telegram.deleteMessage(chatId, statusMessage.message_id).catch(() => {});
    } catch (error) {
      logger.error({ userId, url, error }, 'Failed to process URL');
      await ctx.telegram.editMessageText(
        chatId,
        statusMessage.message_id,
        undefined,
        `❌ Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async sendVideo(
    ctx: Context,
    result: DownloadResult,
    url: string
  ): Promise<void> {
    if (!result.filePath) {
      return;
    }

    const caption = this.buildCaption(url, result.title);

    try {
      // Try sending as video first
      await ctx.replyWithVideo(
        { source: result.filePath },
        {
          caption,
          parse_mode: 'HTML',
          supports_streaming: true,
        }
      );
    } catch (error) {
      logger.warn({ error }, 'Failed to send as video, trying as document');

      try {
        // Fallback: send as document
        await ctx.replyWithDocument(
          { source: result.filePath },
          {
            caption,
            parse_mode: 'HTML',
          }
        );
      } catch (docError) {
        logger.error({ docError }, 'Failed to send as document');
        await ctx.reply(`❌ Failed to send file: ${result.title}`);
      }
    } finally {
      // Cleanup
      await cleanupTempDir(result.filePath).catch(() => {});
    }
  }

  private buildCaption(url: string, title?: string): string {
    let caption = '';

    if (title && title !== 'Unknown') {
      // Escape HTML special characters
      const escapedTitle = title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      caption += `<b>${escapedTitle}</b>\n`;
    }

    caption += `\n🔗 <a href="${url}">Source</a>`;

    // Telegram caption limit is 1024 characters
    if (caption.length > 1024) {
      caption = caption.substring(0, 1021) + '...';
    }

    return caption;
  }

  async launch(): Promise<void> {
    logger.info('Starting bot...');
    await this.bot.launch();
    logger.info('Bot is running');

    // Graceful shutdown
    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
  }

  async stop(): Promise<void> {
    logger.info('Stopping bot...');
    await this.bot.stop();
    logger.info('Bot stopped');
  }
}
