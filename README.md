# Telegram Media Downloader Bot

A production-ready Telegram bot that downloads videos from Instagram, TikTok, YouTube, Twitter/X, Facebook, Vimeo, Reddit, and other platforms supported by `yt-dlp`.

## Features

- 🎥 Download videos from multiple platforms (Instagram, TikTok, YouTube, Twitter, Facebook, Vimeo, Reddit, etc.)
- 🔒 Access control via allowed user IDs
- 📦 Fully Dockerized
- 🚀 Auto-publish to GitHub Container Registry via GitHub Actions
- 🧹 Automatic temp file cleanup
- ⏳ Rate limiting and cooldown per user
- 📊 Structured logging with Pino

## Prerequisites

- Docker and Docker Compose
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- GitHub account (for GHCR publishing)

## Getting Started

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your Telegram User ID

1. Start a chat with [@userinfobot](https://t.me/userinfobot)
2. Send any message
3. Copy your user ID (a number like: `123456789`)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_TOKEN=your_bot_token_here
ALLOWED_USER_IDS=your_user_id,another_user_id
DOWNLOAD_TIMEOUT=120
MAX_FILE_SIZE_MB=49
LOG_LEVEL=info
```

### 4. Run with Docker Compose

#### Build and run:

```bash
docker-compose up -d --build
```

#### View logs:

```bash
docker-compose logs -f
```

#### Stop:

```bash
docker-compose down
```

## Local Development

### Install Dependencies

```bash
npm install
```

### Build TypeScript

```bash
npm run build
```

### Run Locally

```bash
# Make sure yt-dlp is installed
brew install yt-dlp  # macOS
# or
sudo apt-get install yt-dlp  # Linux

npm run dev
```

## Docker Image

### Build Manually

```bash
docker build -t tg-media-bot:latest .
```

### Run Manually

```bash
docker run -d \
  --name tg-media-bot \
  -e TELEGRAM_TOKEN=your_token \
  -e ALLOWED_USER_IDS=your_user_id \
  --restart unless-stopped \
  tg-media-bot:latest
```

## GitHub Actions - Auto Publish

The workflow at `.github/workflows/docker.yml` automatically builds and pushes Docker images to GitHub Container Registry (GHCR) on:

- Push to `main` branch
- Tag push (e.g., `v1.0.0`)
- Manual dispatch via GitHub Actions UI

### Image Tags

- `latest` - Latest build from `main`
- `<sha>` - Specific commit SHA
- `<tag>` - Git tag (e.g., `v1.0.0`)

### Using the Published Image

```bash
docker pull ghcr.io/<your-github-username>/save-as-bot:latest

docker run -d \
  --name tg-media-bot \
  -e TELEGRAM_TOKEN=your_token \
  -e ALLOWED_USER_IDS=your_user_id \
  --restart unless-stopped \
  ghcr.io/<your-github-username>/save-as-bot:latest
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_TOKEN` | Yes | - | Telegram Bot Token from @BotFather |
| `ALLOWED_USER_IDS` | Yes | - | Comma-separated list of allowed Telegram user IDs |
| `DOWNLOAD_TIMEOUT` | No | `120` | Maximum download time in seconds |
| `MAX_FILE_SIZE_MB` | No | `49` | Maximum file size in MB (Telegram Bot API limit) |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |

## Telegram Bot API Limits

- **Max file size**: 50 MB for bots (we use 49 MB as safety margin)
- **Caption limit**: 1024 characters
- For larger files, the bot automatically tries lower quality or sends as document

## Supported Platforms

Via `yt-dlp`, the bot supports:

- Instagram (Reels, Videos, IGTV)
- TikTok
- YouTube (Videos, Shorts)
- Twitter / X
- Facebook
- Vimeo
- Reddit
- And [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── docker.yml          # GitHub Actions workflow
├── src/
│   ├── bot/
│   │   └── bot.ts              # Telegram bot handlers
│   ├── services/
│   │   ├── access.ts           # Access control service
│   │   └── downloader.ts       # yt-dlp integration
│   ├── utils/
│   │   ├── logger.ts           # Pino logger
│   │   ├── temp.ts             # Temp file management
│   │   └── url.ts              # URL extraction utilities
│   └── index.ts                # Entry point
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Bot doesn't respond

1. Check if your user ID is in `ALLOWED_USER_IDS`
2. Verify `TELEGRAM_TOKEN` is correct
3. Check bot logs: `docker-compose logs`

### Download fails

1. The URL might be from an unsupported platform
2. Content might be private or geo-blocked
3. Check logs for specific error messages

### File too large

The bot automatically tries to send a lower quality version if the file exceeds `MAX_FILE_SIZE_MB`.

### yt-dlp errors

Ensure `yt-dlp` is up to date in the Docker image. You may need to rebuild:

```bash
docker-compose build --no-cache
```

## Security Considerations

- Bot token is never exposed in the repository
- Only allowed users can interact with the bot
- URLs are validated before processing
- No shell injection vulnerabilities (uses spawn with args array)
- Playlist downloads are disabled

## License

ISC
