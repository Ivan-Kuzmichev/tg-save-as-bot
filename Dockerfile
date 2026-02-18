FROM node:20-slim

# Install yt-dlp and ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    yt-dlp \
    ffmpeg \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pino-pretty for development logging
RUN npm install -g pino-pretty

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dist ./dist

# Create temp directory
RUN mkdir -p /app/temp

# Set environment
ENV NODE_ENV=production

# Run the bot
CMD ["node", "dist/index.js"]
