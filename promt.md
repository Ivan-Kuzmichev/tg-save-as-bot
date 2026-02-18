# Telegram Media Downloader Bot — Technical Specification (Node.js, yt-dlp, Dockerized)

## Overview

A production-ready **Telegram bot** built with **Node.js**, which replicates core functionality of @SaveAsBot.

The bot:

- Accepts links from users (Instagram, TikTok, YouTube, etc.)
- Downloads media using `yt-dlp`
- Sends the video/audio back to the user in Telegram
- Restricts access via `ALLOWED_USER_IDS`
- Runs fully in Docker
- Publishes Docker image automatically to GitHub Container Registry via GitHub Actions

The goal is a clean, production-ready MVP with minimal external dependencies.

---

# Core Functionality

## 1. Bot Behavior

### Input

User sends:

- Direct link to supported platform
- Message containing link
- Multiple links (process sequentially)

### Supported Platforms (via yt-dlp)

- Instagram
- TikTok
- YouTube
- Twitter / X
- Facebook
- Vimeo
- Reddit
- And any other platform supported by yt-dlp

### Output

Bot replies with:

- Downloaded video file (as `video`)
- If video too large → send best smaller format
- If still too large → fallback to document
- Caption includes:
  - Original URL
  - Media title (if available)

---

## 2. Access Control

Environment variable:
TELEGRAM_TOKEN=xxx
ALLOWED_USER_IDS=127528682,387711762

Behavior:

- If user ID not in list → ignore or send "Access denied"
- Admin-only usage model
- Comma-separated IDs
- Parsed at startup

---

## 3. Download Logic (yt-dlp Integration)

Use system-installed `yt-dlp`.

### Execution Strategy

- Spawn via `child_process.spawn`
- Use temp directory per request
- Unique request ID folder
- Cleanup after sending

### Constraints

- Max file size: 49MB (Telegram Bot API limit without premium)
- If > 49MB:
  - Try lower quality
  - Or send as document
- Timeout per download: configurable (default 120 seconds)

---

## 4. Message Flow

### On URL message:

1. Validate user access
2. Extract URL (regex)
3. Send "Downloading..." message
4. Run yt-dlp
5. On success:
   - Send video
6. On error:
   - Send error message
7. Cleanup temp files

---

## 5. Error Handling

Handle:

- Unsupported URL
- Private account
- Geo-blocked
- yt-dlp failure
- Timeout
- File too large
- Telegram send failure

User-friendly responses required.

---

# Architecture

## Tech Stack

- Node.js 20+
- TypeScript
- node-telegram-bot-api OR telegraf
- child_process
- dotenv
- pino (logging)
- fs-extra
- uuid

Optional:

- BullMQ (if queue needed)
- rate limiter

---

# Project Structure
/src
/bot
bot.ts
/services
downloader.ts
access.ts
/utils
temp.ts
logger.ts
index.ts

Dockerfile
docker-compose.yml
.env.example
.github/workflows/docker.yml
README.md

# Environment Variables

## Required

TELEGRAM_TOKEN=xxx
ALLOWED_USER_IDS=127528682,387711762

## Optional

DOWNLOAD_TIMEOUT=120
MAX_FILE_SIZE_MB=49
LOG_LEVEL=info

# Docker

# docker-compose.yml

```yml
version: "3.9"

services:
  bot:
    image: ghcr.io/<github-username>/tg-media-bot:latest
    container_name: tg-media-bot
    environment:
      - TELEGRAM_TOKEN=${TELEGRAM_TOKEN}
      - ALLOWED_USER_IDS=${ALLOWED_USER_IDS}
      - DOWNLOAD_TIMEOUT=${DOWNLOAD_TIMEOUT}
      - MAX_FILE_SIZE_MB=${MAX_FILE_SIZE_MB}
      - LOG_LEVEL=${LOG_LEVEL}
    network_mode: host
    restart: unless-stopped
```

# GitHub Actions (Docker Publish)

Workflow: .github/workflows/docker.yml

Triggers:
•	On push to main
•	On tag
•	Manual dispatch

Steps:
1.	Checkout
2.	Login to GHCR
3.	Build Docker image
4.	Push to:

```
ghcr.io/<github-username>/tg-media-bot:latest
ghcr.io/<github-username>/tg-media-bot:${{ github.sha }}
```

Concurrency & Safety
•	One download per user at a time
•	Global concurrency limit (e.g., 3)
•	Graceful shutdown
•	SIGTERM handling
•	Temp cleanup on exit

Rate Limiting

Prevent abuse:
•	Simple in-memory cooldown per user (e.g., 5 seconds)
•	Reject if multiple simultaneous requests

# Logging

Use structured logging:
•	Incoming request
•	Download start
•	Download success
•	Download error
•	File size
•	Execution time

# Security Considerations

•	Do not allow arbitrary shell injection
•	Validate URL format
•	Use spawn with args array
•	Disable playlist downloads
•	Limit max file size
•	Restrict allowed users

# Test Scenarios

1.	Valid Instagram reel → download and send
2.	TikTok video → download and send
3.	YouTube short → download and send
4.	Unsupported link → error
5.	Private Instagram → proper error
6.	Large file → fallback quality
7.	Unauthorized user → access denied
8.	Multiple URLs in one message → sequential processing
9.	Download timeout → graceful failure

# README Must Include

•	Setup instructions
•	Docker usage
•	How to publish manually
•	Environment variable documentation
•	How to get Telegram bot token (via BotFather)
•	Telegram Bot API size limits reference (via Telegram Bot API)

# Final Constraints

•	Must use yt-dlp
•	Must be Dockerized
•	Must publish to GHCR via GitHub Actions
•	Must restrict by ALLOWED_USER_IDS
•	Must not expose Telegram token in repository
•	Must be production-clean MVP