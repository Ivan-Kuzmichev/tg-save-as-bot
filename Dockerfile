FROM node:20-slim

# Install yt-dlp and ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    yt-dlp \
    ffmpeg \
    ca-certificates \
    curl \
    gnupg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp from official source (more up-to-date than apt)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Install pino-pretty for development logging
RUN npm install -g pino-pretty

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dist ./dist

# Create temp directory with proper permissions
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Set environment
ENV NODE_ENV=production
ENV TMPDIR=/app/temp

# Run the bot
CMD ["node", "dist/index.js"]
